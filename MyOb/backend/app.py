from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
import json
import os
import frontmatter
import uuid
from datetime import date, datetime
from pathlib import Path
import threading
import re

# Local imports
from database import get_db, Note, NoteVersion, Attachment, VideoSummary, Folder, ImportJob, AISettings, EmbeddingJob, GeneratedImage, ImageCollection, ImageCollectionMembership, Client, Project, Job
from journal import body_word_count, name_hints
from ai import get_embedding, cosine_similarity
from local_embeddings import MODEL_DIMENSIONS, MODEL_NAME
from youtube import find_youtube_videos, process_video
from config import VAULT_PATH, ATTACHMENTS_PATH
from file_processor import process_file
from attachment_migration import MAX_ATTACHMENT_BYTES, store_attachment
from security import MeroTrustBoundaryMiddleware, get_request_context, run_with_request_context

app = FastAPI()

standalone_origins = [origin.strip() for origin in os.getenv("MYOB_STANDALONE_CORS_ORIGINS", "").split(",") if origin.strip()]
if standalone_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=standalone_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
app.add_middleware(MeroTrustBoundaryMiddleware)


@app.get("/health")
def health():
    return {"ok": True, "embedding_model": MODEL_NAME, "embedding_dimensions": MODEL_DIMENSIONS}


def record_note_version(db: Session, note: Note) -> None:
    db.add(NoteVersion(
        id=str(uuid.uuid4()), note_id=note.id, version=note.current_version or 1,
        title=note.title, content=note.content, tags=list(note.tags or []),
        folder_id=note.folder_id, space=note.space, project_id=note.project_id,
        created_at=datetime.utcnow(),
    ))


def entry_payload(note: Note) -> dict:
    """Journal fields shared by every note response."""
    return {
        "kind": note.kind,
        "entry_date": note.entry_date.isoformat() if note.entry_date else None,
        "space": note.space,
        "project_id": note.project_id,
        "assignment": note.assignment,
        "source": note.source,
        "word_count": note.word_count,
    }


def resolve_project(db: Session, project_id: Optional[str]) -> Optional[str]:
    """Reject a project id that is not this tenant's."""
    if project_id is None:
        return None
    if not db.query(Project).filter(Project.id == project_id).first():
        raise HTTPException(status_code=404, detail="Project not found")
    return project_id


def embedding_fields(title: str, content: str) -> dict:
    clean_content = re.sub(r'!\[[^\]]*\]\(data:image/[^)]+\)', '[IMAGE]', content or '')[:4000]
    try:
        vector = get_embedding(f"{title}\n{clean_content}")
        return {
            "embedding": json.dumps(vector), "embedding_model": MODEL_NAME,
            "embedding_dimensions": len(vector), "embedding_status": "ready", "embedding_error": None,
        }
    except Exception as error:
        return {
            "embedding": None, "embedding_model": MODEL_NAME, "embedding_dimensions": MODEL_DIMENSIONS,
            "embedding_status": "failed", "embedding_error": type(error).__name__,
        }

def scan_vault():
    """Generator function to read all markdown files from the vault."""
    vault_path = Path(VAULT_PATH)
    for file_path in vault_path.rglob('*.md'):
        if '.obsidian' in str(file_path):
            continue
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)
                rel_path = str(file_path.relative_to(vault_path))
                yield {
                    'id': rel_path,
                    'title': post.get('title') or file_path.stem,
                    'content': post.content,
                    'tags': post.get('tags', []),
                    'path': str(file_path)
                }
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            continue

@app.get("/api/notes")
def get_notes(q: Optional[str] = None, folder_id: Optional[str] = None, tag: Optional[str] = None, db: Session = Depends(get_db)):
    """Return a filtered lightweight note list with plain excerpts."""
    query = db.query(Note)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(or_(Note.title.ilike(term), Note.content.ilike(term)))
    if folder_id:
        query = query.filter(Note.folder_id == folder_id)
    notes = query.order_by(Note.title).all()
    if tag:
        notes = [note for note in notes if tag in (note.tags or [])]
    return [{
        'id': note.id, 'title': note.title, 'tags': note.tags or [], 'folder_id': note.folder_id,
        'excerpt': ' '.join((note.content or '').replace('\n', ' ').split())[:240],
        'embedding_status': note.embedding_status,
        **entry_payload(note),
        'created_at': note.created_at.isoformat() if note.created_at else None,
        'modified_at': note.updated_at.isoformat() if note.updated_at else None,
    } for note in notes]


@app.get("/api/semantic-search")
def semantic_search(q: str, limit: int = 20, db: Session = Depends(get_db)):
    """Search notes by meaning using one validated local embedding space."""
    if not q.strip() or not 1 <= limit <= 100:
        raise HTTPException(status_code=400, detail="Query is required and limit must be between 1 and 100")
    from local_embeddings import get_local_embedding_provider
    query_embedding = get_local_embedding_provider().embed_query(q)
    notes = db.query(Note).filter(
        Note.embedding_status == "ready",
        Note.embedding_model == MODEL_NAME,
        Note.embedding_dimensions == MODEL_DIMENSIONS,
    ).all()

    results = []
    for note in notes:
        try:
            note_embedding = json.loads(note.embedding)
        except (TypeError, json.JSONDecodeError):
            continue
        if len(note_embedding) != MODEL_DIMENSIONS:
            continue
        similarity = cosine_similarity(query_embedding, note_embedding)
        if similarity > 0.3:
            results.append({'id': note.id, 'title': note.title, 'similarity': similarity})

    results.sort(key=lambda item: item['similarity'], reverse=True)
    return {'results': results[:limit], 'model': MODEL_NAME, 'dimensions': MODEL_DIMENSIONS}

@app.get("/api/notes/{note_id:path}/videos")
def get_note_videos(note_id: str, db: Session = Depends(get_db)):
    """Find YouTube videos in a note and check their processing status."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    videos = find_youtube_videos(note.content)
    
    for video in videos:
        existing = db.query(VideoSummary).filter(VideoSummary.video_id == video['id']).first()
        video['processed'] = bool(existing)
        if existing:
            video['summary'] = existing.summary
            
    return {'videos': videos}

@app.post("/api/videos/{video_id}/process")
def process_video_endpoint(video_id: str, note_id: str, db: Session = Depends(get_db)):
    """Process a YouTube video and save the summary."""
    existing = db.query(VideoSummary).filter(VideoSummary.video_id == video_id).first()
    if existing:
        return {'summary': existing.summary, 'cached': True}
    
    try:
        result = process_video(video_id)
        
        video_summary = VideoSummary(
            video_id=video_id,
            note_id=note_id,
            summary=result['summary'],
            transcript=result['transcript'],
            title=result['title']
        )
        db.add(video_summary)
        db.commit()
        return {'summary': result['summary'], 'cached': False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    """Return basic statistics about the system."""
    note_count = db.query(Note).count()
    video_count = db.query(VideoSummary).count()
    return {
        'note_count': note_count,
        'video_count': video_count,
        'status': 'ok'
    }

@app.get("/api/folders")
def get_folders(db: Session = Depends(get_db)):
    """Return all folders from the database."""
    folders = db.query(Folder).order_by(Folder.name).all()
    return [{'id': folder.id, 'name': folder.name, 'parent_id': folder.parent_id} for folder in folders]

@app.get("/api/folders/{folder_id:path}/notes")
def get_folder_notes(folder_id: str, db: Session = Depends(get_db)):
    """Return all notes within a specific folder."""
    notes = db.query(Note).filter(Note.folder_id == folder_id).order_by(Note.title).all()
    return [{'id': note.id, 'title': note.title, 'tags': note.tags or []} for note in notes]

@app.get("/api/folders/{folder_id:path}")
def get_folder(folder_id: str, db: Session = Depends(get_db)):
    """Return a single folder by its ID (relative path)."""
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    return {
        "id": folder.id,
        "name": folder.name,
        "parent_id": folder.parent_id,
        "created_at": folder.created_at
    }

@app.post("/api/folders")
def create_folder(folder_data: dict, db: Session = Depends(get_db)):
    """Create a new folder in the database."""
    folder_name = folder_data.get('name')
    parent_id = folder_data.get('parent_id')
    
    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name is required")
    
    # Generate a unique ID for the folder
    folder_id = str(uuid.uuid4())
    
    # Check if folder with same name and parent already exists
    existing_folder = db.query(Folder).filter(
        Folder.name == folder_name,
        Folder.parent_id == parent_id
    ).first()
    if existing_folder:
        raise HTTPException(status_code=400, detail="Folder with this name already exists in this location")
    
    # Create folder in database (no file system needed)
    new_folder = Folder(
        id=folder_id,
        name=folder_name,
        parent_id=parent_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    
    return {
        "id": new_folder.id,
        "name": new_folder.name,
        "parent_id": new_folder.parent_id,
        "created_at": new_folder.created_at.isoformat() if new_folder.created_at else None
    }

@app.put("/api/notes/{note_id:path}/move")
def move_note_to_folder(note_id: str, folder_data: dict, db: Session = Depends(get_db)):
    """Move a note to a different folder."""
    folder_id = folder_data.get('folder_id')
    
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note.folder_id = folder_id
    note.updated_at = datetime.utcnow()
    note.current_version += 1
    record_note_version(db, note)
    db.commit()
    
    return {"id": note.id, "title": note.title, "folder_id": note.folder_id}

# ============================================================================
# CRUD ENDPOINTS (Standalone Database Mode)
# ============================================================================

class NoteCreate(BaseModel):
    title: str
    content: str
    tags: Optional[List[str]] = []
    folder_id: Optional[str] = None
    kind: Literal["note", "entry", "summary"] = "note"
    entry_date: Optional[date] = None
    space: Literal["work", "personal"] = "work"
    project_id: Optional[str] = None
    source: Literal["text", "voice", "import"] = "text"

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    folder_id: Optional[str] = None
    version: Optional[int] = None
    kind: Optional[Literal["note", "entry", "summary"]] = None
    entry_date: Optional[date] = None
    space: Optional[Literal["work", "personal"]] = None
    project_id: Optional[str] = None
    source: Optional[Literal["text", "voice", "import"]] = None

@app.post("/api/notes")
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
    """Create a new note in the database."""
    # Generate a unique ID for the note
    note_id = str(uuid.uuid4())
    
    embedding = embedding_fields(note_data.title, note_data.content)
    entry_date = note_data.entry_date if note_data.kind == "entry" else None
    if note_data.kind == "entry" and entry_date is None:
        entry_date = datetime.utcnow().date()

    # Create new note
    new_note = Note(
        id=note_id,
        current_version=1,
        title=note_data.title,
        content=note_data.content,
        tags=note_data.tags or [],
        folder_id=note_data.folder_id,
        kind=note_data.kind,
        entry_date=entry_date,
        space=note_data.space,
        project_id=resolve_project(db, note_data.project_id),
        assignment="manual" if note_data.project_id or note_data.kind != "entry" else "unassigned",
        source=note_data.source,
        word_count=body_word_count(note_data.content),
        **embedding,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_note)
    record_note_version(db, new_note)
    db.commit()
    db.refresh(new_note)
    
    return {
        "id": new_note.id,
        "title": new_note.title,
        "content": new_note.content,
        "tags": new_note.tags,
        "folder_id": new_note.folder_id,
        "embedding_status": new_note.embedding_status,
        "version": new_note.current_version,
        **entry_payload(new_note),
        "created_at": new_note.created_at.isoformat() if new_note.created_at else None,
        "updated_at": new_note.updated_at.isoformat() if new_note.updated_at else None
    }

@app.put("/api/notes/{note_id:path}")
def update_note(note_id: str, note_data: NoteUpdate, db: Session = Depends(get_db)):
    """Update an existing note."""
    import time
    start_time = time.time()
    print(f"[Save] Starting update for note {note_id}")
    
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note_data.version is not None and note_data.version != note.current_version:
        raise HTTPException(status_code=409, detail={"error": "version_conflict", "current_version": note.current_version})

    query_time = time.time()
    print(f"[Save] Query took {(query_time - start_time)*1000:.2f}ms")
    
    # Update fields if provided
    if note_data.title is not None:
        note.title = note_data.title
    
    if note_data.content is not None:
        note.content = note_data.content
    
    if note_data.tags is not None:
        note.tags = note_data.tags
    
    if note_data.folder_id is not None:
        note.folder_id = note_data.folder_id

    if note_data.kind is not None:
        note.kind = note_data.kind
    if note_data.entry_date is not None:
        note.entry_date = note_data.entry_date
    if note_data.space is not None:
        note.space = note_data.space
    if note_data.project_id is not None:
        note.project_id = resolve_project(db, note_data.project_id)
        note.assignment = "manual"
    if note_data.source is not None:
        note.source = note_data.source
    if note.kind == "entry" and note.entry_date is None:
        note.entry_date = datetime.utcnow().date()
    note.word_count = body_word_count(note.content)

    note.updated_at = datetime.utcnow()
    note.current_version += 1
    record_note_version(db, note)

    update_time = time.time()
    print(f"[Save] Field updates took {(update_time - query_time)*1000:.2f}ms")
    
    db.commit()
    
    commit_time = time.time()
    print(f"[Save] Commit took {(commit_time - update_time)*1000:.2f}ms")
    
    db.refresh(note)
    
    refresh_time = time.time()
    print(f"[Save] Refresh took {(refresh_time - commit_time)*1000:.2f}ms")
    
    # Regenerate embedding if title or content changed - DO THIS IN BACKGROUND
    # This allows the save to return immediately while embedding updates async
    should_update_embedding = note_data.title is not None or note_data.content is not None
    
    if should_update_embedding:
        note.embedding_status = "pending"
        note.embedding_error = None
        db.commit()
        worker_context = get_request_context()

        def update_embedding_async():
            """Update embedding state without rolling back the successful note save."""
            from database import SessionLocal
            db_async = SessionLocal()
            try:
                note_async = db_async.query(Note).filter(Note.id == note_id).first()
                if not note_async:
                    return
                for field, value in embedding_fields(note_async.title, note_async.content).items():
                    setattr(note_async, field, value)
                db_async.commit()
            except Exception as error:
                db_async.rollback()
                failed_note = db_async.query(Note).filter(Note.id == note_id).first()
                if failed_note:
                    failed_note.embedding_status = "failed"
                    failed_note.embedding_error = type(error).__name__
                    db_async.commit()
            finally:
                db_async.close()
        
        # Start background thread
        thread = threading.Thread(target=lambda: run_with_request_context(worker_context, update_embedding_async), daemon=True)
        thread.start()
        print(f"[Embedding:Background] Started async update for {note_id}")
    
    before_return = time.time()
    print(f"[Save] Total before return: {(before_return - start_time)*1000:.2f}ms")
    
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "tags": note.tags,
        "folder_id": note.folder_id,
        "embedding_status": note.embedding_status,
        "version": note.current_version,
        **entry_payload(note),
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None
    }

@app.delete("/api/notes/{note_id:path}")
def delete_note(note_id: str, db: Session = Depends(get_db)):
    """Delete a note from the database."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Also delete associated video summaries
    db.query(VideoSummary).filter(VideoSummary.note_id == note_id).delete()
    
    db.delete(note)
    db.commit()
    
    return {"message": "Note deleted successfully", "id": note_id}

class MarkdownFile(BaseModel):
    filename: str
    content: str
    folder_id: Optional[str] = None

class BulkImportRequest(BaseModel):
    files: List[MarkdownFile]

@app.post("/api/notes/import-bulk")
def bulk_import_notes(import_data: BulkImportRequest, db: Session = Depends(get_db)):
    """Import multiple markdown files at once.
    
    This allows users to paste/drag multiple .md files into the app.
    Each file's content should include YAML frontmatter with title/tags.
    """
    results = {
        "imported": [],
        "errors": []
    }
    
    for file_data in import_data.files:
        try:
            # Parse frontmatter and content
            post = frontmatter.loads(file_data.content)
            
            # Extract title from frontmatter or filename
            title = post.get('title') or Path(file_data.filename).stem
            content = post.content
            tags = post.get('tags', [])
            
            # Generate unique ID
            note_id = str(uuid.uuid4())
            
            # Generate embedding
            try:
                embedding_text = f"{title}\n{content}"
                embedding = get_embedding(embedding_text)
                embedding_json = json.dumps(embedding)
            except Exception as e:
                print(f"Warning: Could not generate embedding for {title}: {e}")
                embedding_json = None
            
            # Create note
            new_note = Note(
                id=note_id,
                title=title,
                content=content,
                tags=tags,
                embedding=embedding_json,
                embedding_model=MODEL_NAME,
                embedding_dimensions=MODEL_DIMENSIONS,
                embedding_status="ready" if embedding_json else "failed",
                folder_id=file_data.folder_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(new_note)
            db.commit()
            db.refresh(new_note)
            
            results["imported"].append({
                "id": new_note.id,
                "title": new_note.title,
                "filename": file_data.filename
            })
            
        except Exception as e:
            results["errors"].append({
                "filename": file_data.filename,
                "error": str(e)
            })
            db.rollback()
            continue
    
    return {
        "success": len(results["imported"]),
        "failed": len(results["errors"]),
        "imported": results["imported"],
        "errors": results["errors"]
    }

# ============================================================================
# CONTENT IMPORT ENDPOINTS (Universal Content Importer)
# ============================================================================

class ContentImportQuickRequest(BaseModel):
    url: str
    folder_id: Optional[str] = None
    generate_summary: bool = True
    summary_length: str = "medium"  # brief, medium, detailed
    auto_tag: bool = True
    custom_title: Optional[str] = None

class ContentImportBulkItem(BaseModel):
    url: str
    custom_title: Optional[str] = None

class ContentImportBulkRequest(BaseModel):
    items: List[ContentImportBulkItem]
    folder_id: Optional[str] = None
    generate_summary: bool = True
    summary_length: str = "medium"
    auto_tag: bool = True

@app.post("/api/content/import/quick")
def import_content_quick(request: ContentImportQuickRequest, db: Session = Depends(get_db)):
    """
    Quick import for a single URL/content item.
    
    Extracts content, generates summary and tags (if enabled),
    creates a note in the database.
    """
    try:
        from content_processor import process_content_item
        
        # Process the content
        options = {
            'generate_summary': request.generate_summary,
            'summary_length': request.summary_length,
            'auto_tag': request.auto_tag,
            'custom_title': request.custom_title
        }
        
        result = process_content_item(request.url, options)
        
        # Build note content with frontmatter
        frontmatter_lines = ["---"]
        frontmatter_lines.append(f'title: "{result["title"]}"')
        
        if result['tags']:
            frontmatter_lines.append("tags:")
            for tag in result['tags']:
                frontmatter_lines.append(f'  - "{tag}"')
        
        # Add metadata
        frontmatter_lines.append(f'source: "{result["source_url"]}"')
        frontmatter_lines.append(f'content_type: "{result["content_type"]}"')
        frontmatter_lines.append(f'imported_at: "{result["extracted_at"]}"')
        
        frontmatter_lines.append("---")
        frontmatter_block = "\n".join(frontmatter_lines) + "\n\n"
        
        # Build note body
        note_body_parts = []
        
        # Add summary if available
        if result['summary']:
            note_body_parts.append("## Summary\n\n" + result['summary'] + "\n")
        
        # Add full content
        note_body_parts.append("## Content\n\n" + result['content'])
        
        note_content = frontmatter_block + "\n".join(note_body_parts)
        
        # Generate unique ID
        note_id = str(uuid.uuid4())
        
        # Generate embedding
        try:
            embedding_text = f"{result['title']}\n{result['content']}"
            embedding = get_embedding(embedding_text)
            embedding_json = json.dumps(embedding)
        except Exception as e:
            print(f"Warning: Could not generate embedding: {e}")
            embedding_json = None
        
        # Create note in database
        new_note = Note(
            id=note_id,
            title=result['title'],
            content=note_content,
            tags=result['tags'],
            embedding=embedding_json,
            embedding_model=MODEL_NAME,
            embedding_dimensions=MODEL_DIMENSIONS,
            embedding_status="ready" if embedding_json else "failed",
            folder_id=request.folder_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(new_note)
        
        # If it's a YouTube video, also create VideoSummary entry
        if result['content_type'] == 'youtube' and result.get('metadata', {}).get('video_id'):
            video_id = result['metadata']['video_id']
            existing_video = db.query(VideoSummary).filter(VideoSummary.video_id == video_id).first()
            if not existing_video:
                video_summary = VideoSummary(
                    video_id=video_id,
                    note_id=note_id,
                    title=result['title'],
                    summary=result['summary'],
                    transcript=result['content'],
                    created_at=datetime.utcnow()
                )
                db.add(video_summary)
        
        db.commit()
        db.refresh(new_note)
        
        return {
            "success": True,
            "note_id": new_note.id,
            "title": new_note.title,
            "content_type": result['content_type'],
            "tags": result['tags'],
            "has_summary": bool(result['summary']),
            "transcript_available": result.get('metadata', {}).get('transcript_available', True),
            "metadata": result.get('metadata', {})
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@app.post("/api/content/import/bulk")
def import_content_bulk(request: ContentImportBulkRequest, db: Session = Depends(get_db)):
    """
    Start a bulk import job for multiple URLs.
    
    Returns a job_id that can be used to track progress.
    Processing happens in the background.
    """
    import threading
    from content_processor import process_content_item
    
    # Create job
    job_id = str(uuid.uuid4())
    
    job = ImportJob(
        id=job_id,
        status="pending",
        total_items=len(request.items),
        completed_items=0,
        failed_items=0,
        results=[],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(job)
    db.commit()
    
    # Process items in background thread
    worker_context = get_request_context()

    def process_items():
        from database import SessionLocal
        db_session = SessionLocal()
        
        try:
            # Update job status
            job_record = db_session.query(ImportJob).filter(ImportJob.id == job_id).first()
            job_record.status = "processing"
            db_session.commit()
            
            results = []
            
            for item in request.items:
                try:
                    # Process content
                    options = {
                        'generate_summary': request.generate_summary,
                        'summary_length': request.summary_length,
                        'auto_tag': request.auto_tag,
                        'custom_title': item.custom_title
                    }
                    
                    result = process_content_item(item.url, options)
                    
                    # Build note content (same as quick import)
                    frontmatter_lines = ["---"]
                    frontmatter_lines.append(f'title: "{result["title"]}"')
                    
                    if result['tags']:
                        frontmatter_lines.append("tags:")
                        for tag in result['tags']:
                            frontmatter_lines.append(f'  - "{tag}"')
                    
                    frontmatter_lines.append(f'source: "{result["source_url"]}"')
                    frontmatter_lines.append(f'content_type: "{result["content_type"]}"')
                    frontmatter_lines.append(f'imported_at: "{result["extracted_at"]}"')
                    frontmatter_lines.append("---")
                    frontmatter_block = "\n".join(frontmatter_lines) + "\n\n"
                    
                    note_body_parts = []
                    if result['summary']:
                        note_body_parts.append("## Summary\n\n" + result['summary'] + "\n")
                    note_body_parts.append("## Content\n\n" + result['content'])
                    
                    note_content = frontmatter_block + "\n".join(note_body_parts)
                    
                    # Create note
                    note_id = str(uuid.uuid4())
                    
                    try:
                        embedding_text = f"{result['title']}\n{result['content']}"
                        embedding = get_embedding(embedding_text)
                        embedding_json = json.dumps(embedding)
                    except Exception:
                        embedding_json = None
                    
                    new_note = Note(
                        id=note_id,
                        title=result['title'],
                        content=note_content,
                        tags=result['tags'],
                        embedding=embedding_json,
                        embedding_model=MODEL_NAME,
                        embedding_dimensions=MODEL_DIMENSIONS,
                        embedding_status="ready" if embedding_json else "failed",
                        folder_id=request.folder_id,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    
                    db_session.add(new_note)
                    
                    # Handle YouTube videos
                    if result['content_type'] == 'youtube' and result.get('metadata', {}).get('video_id'):
                        video_id = result['metadata']['video_id']
                        existing_video = db_session.query(VideoSummary).filter(VideoSummary.video_id == video_id).first()
                        if not existing_video:
                            video_summary = VideoSummary(
                                video_id=video_id,
                                note_id=note_id,
                                title=result['title'],
                                summary=result['summary'],
                                transcript=result['content'],
                                created_at=datetime.utcnow()
                            )
                            db_session.add(video_summary)
                    
                    db_session.commit()
                    
                    results.append({
                        'url': item.url,
                        'status': 'success',
                        'note_id': note_id,
                        'title': result['title'],
                        'content_type': result['content_type'],
                        'transcript_available': result.get('metadata', {}).get('transcript_available', True),
                        'error': None
                    })
                    
                    # Update job progress
                    job_record = db_session.query(ImportJob).filter(ImportJob.id == job_id).first()
                    job_record.completed_items += 1
                    job_record.results = results
                    job_record.updated_at = datetime.utcnow()
                    db_session.commit()
                    
                except Exception as e:
                    # Record failure but continue
                    error_msg = str(e)
                    results.append({
                        'url': item.url,
                        'status': 'failed',
                        'note_id': None,
                        'title': None,
                        'error': error_msg
                    })
                    
                    job_record = db_session.query(ImportJob).filter(ImportJob.id == job_id).first()
                    job_record.failed_items += 1
                    job_record.results = results
                    job_record.updated_at = datetime.utcnow()
                    db_session.commit()
                    
                    db_session.rollback()
                    continue
            
            # Mark job as completed
            job_record = db_session.query(ImportJob).filter(ImportJob.id == job_id).first()
            job_record.status = "completed"
            job_record.updated_at = datetime.utcnow()
            db_session.commit()
            
        except Exception as e:
            # Mark job as failed
            job_record = db_session.query(ImportJob).filter(ImportJob.id == job_id).first()
            if job_record:
                job_record.status = "failed"
                job_record.updated_at = datetime.utcnow()
                db_session.commit()
        
        finally:
            db_session.close()
    
    # Start background thread
    thread = threading.Thread(target=lambda: run_with_request_context(worker_context, process_items), daemon=True)
    thread.start()
    
    return {
        "success": True,
        "job_id": job_id,
        "total_items": len(request.items),
        "message": "Import job started"
    }

@app.get("/api/content/import/{job_id}/status")
def get_import_job_status(job_id: str, db: Session = Depends(get_db)):
    """
    Get the status of a bulk import job.
    
    Returns progress information and results.
    """
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    
    return {
        "job_id": job.id,
        "status": job.status,
        "total": job.total_items,
        "completed": job.completed_items,
        "failed": job.failed_items,
        "results": job.results or [],
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None
    }

# ============================================================================
# AI ASSISTANT ENDPOINTS
# ============================================================================

from ai_service import AIAssistService
from codex_provider import CodexProviderError

class AIHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)

class AIChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=8000)
    current_note_id: Optional[str] = Field(default=None, max_length=256)
    conversation_history: List[AIHistoryMessage] = Field(default_factory=list, max_length=10)

class LinkSuggestionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=16000)
    current_note_id: str = Field(min_length=1, max_length=256)
    num_suggestions: int = Field(default=5, ge=1, le=20)

@app.post("/api/ai/chat")
async def ai_chat(request: AIChatRequest, db: Session = Depends(get_db)):
    """
    AI chat endpoint with semantic search and citations from vault.
    """
    # Check if AI chat is enabled
    settings = db.query(AISettings).filter(AISettings.id == 'default').first()
    if settings and not settings.ai_chat_enabled:
        raise HTTPException(status_code=403, detail="AI Chat is disabled in settings")
    
    ai_service = AIAssistService(db)
    
    try:
        result = await ai_service.answer_question(
            query=request.query,
            current_note_id=request.current_note_id,
            conversation_history=[message.model_dump() for message in request.conversation_history]
        )
        return result
    except CodexProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=error.code)
    except Exception:
        raise HTTPException(status_code=500, detail="AI_CHAT_FAILED")

@app.post("/api/ai/general-chat")
async def ai_general_chat(request: AIChatRequest, db: Session = Depends(get_db)):
    """
    AI chat endpoint for general questions without vault context.
    """
    # Check if AI chat is enabled
    settings = db.query(AISettings).filter(AISettings.id == 'default').first()
    if settings and not settings.ai_chat_enabled:
        raise HTTPException(status_code=403, detail="AI Chat is disabled in settings")
    
    ai_service = AIAssistService(db)
    
    try:
        result = await ai_service.general_chat(
            query=request.query,
            conversation_history=[message.model_dump() for message in request.conversation_history]
        )
        return result
    except CodexProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=error.code)
    except Exception:
        raise HTTPException(status_code=500, detail="AI_CHAT_FAILED")

@app.post("/api/ai/suggest-links")
def suggest_links(request: LinkSuggestionRequest, db: Session = Depends(get_db)):
    """
    Suggest relevant notes to link based on text.
    """
    # Check if link suggestions are enabled
    settings = db.query(AISettings).filter(AISettings.id == 'default').first()
    if settings and not settings.link_suggestions_enabled:
        return {"suggestions": []}  # Return empty if disabled
    
    ai_service = AIAssistService(db)
    
    try:
        suggestions = ai_service.suggest_links(
            text=request.text,
            current_note_id=request.current_note_id,
            num_suggestions=request.num_suggestions
        )
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/save-conversation")
def save_conversation(conversation_data: dict, db: Session = Depends(get_db)):
    """
    Save a conversation to database.
    """
    ai_service = AIAssistService(db)
    
    try:
        result = ai_service.save_conversation(
            messages=conversation_data.get('messages', []),
            title=conversation_data.get('title')
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/conversation-history")
def get_conversation_history(limit: int = 20, db: Session = Depends(get_db)):
    """
    Get recent conversation history.
    """
    ai_service = AIAssistService(db)
    
    try:
        history = ai_service.get_conversation_history(limit=limit)
        return {"conversations": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/analyze-connections/{note_id:path}")
def analyze_connections(note_id: str, db: Session = Depends(get_db)):
    """
    Analyze note connections and suggest improvements.
    """
    ai_service = AIAssistService(db)
    
    try:
        analysis = ai_service.analyze_note_connections(note_id=note_id)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# AI IMAGE GENERATION ENDPOINTS
# ============================================================================

class ImageGenerationRequest(BaseModel):
    prompt: str
    aspect_ratio: Optional[str] = "1:1"
    note_id: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None

@app.post("/api/ai/generate-image")
async def generate_image_endpoint(request: ImageGenerationRequest, db: Session = Depends(get_db)):
    """
    Generate an image using Gemini 2.5 Flash Image model.
    Stores the generated image in database with gallery-ready metadata.
    """
    from ai import generate_image
    import uuid
    
    try:
        # Generate the image
        result = generate_image(request.prompt, request.aspect_ratio)
        
        # Store in database
        image_id = str(uuid.uuid4())
        generated_image = GeneratedImage(
            id=image_id,
            note_id=request.note_id,
            prompt=request.prompt,
            image_data=result['image_data'],
            mime_type=result['mime_type'],
            aspect_ratio=result['aspect_ratio'],
            tags=request.tags or [],
            category=request.category,
            is_favorite=False,
            display_order=0,
            generation_params={
                'model': 'google/gemini-2.5-flash-image',
                'aspect_ratio': result['aspect_ratio']
            }
        )
        
        db.add(generated_image)
        db.commit()
        db.refresh(generated_image)
        
        return {
            "success": True,
            "image_id": image_id,
            "image_data": result['image_data'],
            "mime_type": result['mime_type'],
            "aspect_ratio": result['aspect_ratio'],
            "prompt": request.prompt
        }
        
    except Exception as e:
        print(f"Error generating image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/images/{image_id}")
def get_generated_image(image_id: str, db: Session = Depends(get_db)):
    """
    Get a generated image by ID.
    """
    image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    return {
        "id": image.id,
        "note_id": image.note_id,
        "prompt": image.prompt,
        "image_data": image.image_data,
        "mime_type": image.mime_type,
        "aspect_ratio": image.aspect_ratio,
        "tags": image.tags,
        "category": image.category,
        "is_favorite": image.is_favorite,
        "created_at": image.created_at.isoformat() if image.created_at else None
    }

@app.get("/api/notes/{note_id}/images")
def get_note_images(note_id: str, db: Session = Depends(get_db)):
    """
    Get all generated images for a specific note.
    """
    images = db.query(GeneratedImage).filter(GeneratedImage.note_id == note_id).order_by(GeneratedImage.created_at.desc()).all()
    
    return {
        "images": [
            {
                "id": img.id,
                "prompt": img.prompt,
                "image_data": img.image_data,
                "mime_type": img.mime_type,
                "aspect_ratio": img.aspect_ratio,
                "tags": img.tags,
                "is_favorite": img.is_favorite,
                "created_at": img.created_at.isoformat() if img.created_at else None
            }
            for img in images
        ]
    }

@app.delete("/api/images/{image_id}")
def delete_generated_image(image_id: str, db: Session = Depends(get_db)):
    """
    Delete a generated image.
    """
    image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    db.delete(image)
    db.commit()
    
    return {"success": True, "message": "Image deleted successfully"}

@app.put("/api/images/{image_id}/favorite")
def toggle_image_favorite(image_id: str, is_favorite: bool, db: Session = Depends(get_db)):
    """
    Toggle favorite status for an image.
    """
    image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image.is_favorite = is_favorite
    image.updated_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "is_favorite": is_favorite}

@app.put("/api/images/{image_id}/tags")
def update_image_tags(image_id: str, tags: List[str], db: Session = Depends(get_db)):
    """
    Update tags for an image.
    """
    image = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image.tags = tags
    image.updated_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "tags": tags}

# ============================================================================
# AI SETTINGS ENDPOINTS
# ============================================================================

class AISettingsUpdate(BaseModel):
    ai_chat_enabled: Optional[bool] = None
    link_suggestions_enabled: Optional[bool] = None
    auto_tag_enabled: Optional[bool] = None
    chat_model: Optional[str] = None
    temperature: Optional[float] = None
    max_context_notes: Optional[int] = None
    send_full_content: Optional[bool] = None
    exclude_private_tags: Optional[bool] = None
    save_conversations: Optional[bool] = None
    link_suggestion_debounce: Optional[int] = None

@app.get("/api/ai/settings")
def get_ai_settings(db: Session = Depends(get_db)):
    """
    Get current AI settings.
    Creates default settings if none exist.
    """
    settings = db.query(AISettings).filter(AISettings.id == 'default').first()
    
    if not settings:
        # Create default settings
        settings = AISettings(
            id='default',
            ai_chat_enabled=True,
            link_suggestions_enabled=True,
            auto_tag_enabled=False,
            chat_model='google/gemini-2.5-flash',
            temperature=0.7,
            max_context_notes=5,
            send_full_content=False,
            exclude_private_tags=True,
            save_conversations=True,
            link_suggestion_debounce=500,
            updated_at=datetime.utcnow()
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return {
        "ai_chat_enabled": settings.ai_chat_enabled,
        "link_suggestions_enabled": settings.link_suggestions_enabled,
        "auto_tag_enabled": settings.auto_tag_enabled,
        "chat_model": settings.chat_model,
        "temperature": settings.temperature,
        "max_context_notes": settings.max_context_notes,
        "send_full_content": settings.send_full_content,
        "exclude_private_tags": settings.exclude_private_tags,
        "save_conversations": settings.save_conversations,
        "link_suggestion_debounce": settings.link_suggestion_debounce,
        "updated_at": settings.updated_at.isoformat() if settings.updated_at else None
    }

@app.put("/api/ai/settings")
def update_ai_settings(settings_data: AISettingsUpdate, db: Session = Depends(get_db)):
    """
    Update AI settings.
    """
    settings = db.query(AISettings).filter(AISettings.id == 'default').first()
    
    if not settings:
        # Create settings if doesn't exist
        settings = AISettings(id='default')
        db.add(settings)
    
    # Update provided fields
    if settings_data.ai_chat_enabled is not None:
        settings.ai_chat_enabled = settings_data.ai_chat_enabled
    
    if settings_data.link_suggestions_enabled is not None:
        settings.link_suggestions_enabled = settings_data.link_suggestions_enabled
    
    if settings_data.auto_tag_enabled is not None:
        settings.auto_tag_enabled = settings_data.auto_tag_enabled
    
    if settings_data.chat_model is not None:
        settings.chat_model = settings_data.chat_model
    
    if settings_data.temperature is not None:
        settings.temperature = settings_data.temperature
    
    if settings_data.max_context_notes is not None:
        settings.max_context_notes = settings_data.max_context_notes
    
    if settings_data.send_full_content is not None:
        settings.send_full_content = settings_data.send_full_content
    
    if settings_data.exclude_private_tags is not None:
        settings.exclude_private_tags = settings_data.exclude_private_tags
    
    if settings_data.save_conversations is not None:
        settings.save_conversations = settings_data.save_conversations
    
    if settings_data.link_suggestion_debounce is not None:
        settings.link_suggestion_debounce = settings_data.link_suggestion_debounce
    
    settings.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(settings)
    
    return {
        "success": True,
        "settings": {
            "ai_chat_enabled": settings.ai_chat_enabled,
            "link_suggestions_enabled": settings.link_suggestions_enabled,
            "auto_tag_enabled": settings.auto_tag_enabled,
            "chat_model": settings.chat_model,
            "temperature": settings.temperature,
            "max_context_notes": settings.max_context_notes,
            "send_full_content": settings.send_full_content,
            "exclude_private_tags": settings.exclude_private_tags,
            "save_conversations": settings.save_conversations,
            "link_suggestion_debounce": settings.link_suggestion_debounce
        }
    }

# ============================================================================
# FILE UPLOAD ENDPOINT
# ============================================================================

# ============================================================================
# VAULT/FOLDER IMPORT ENDPOINT
# ============================================================================

class VaultImportRequest(BaseModel):
    folder_path: str
    include_subfolders: bool = True
    preserve_structure: bool = True
    target_folder_id: Optional[str] = None  # If not preserving structure, put all in this folder

@app.post("/api/vault/import")
def import_from_vault(request: VaultImportRequest, db: Session = Depends(get_db)):
    """
    Import all markdown files from a folder/vault.

    - folder_path: Path to the folder containing .md files
    - include_subfolders: Whether to scan subfolders recursively
    - preserve_structure: Create folders in MyOb matching the source structure
    - target_folder_id: If not preserving structure, import all to this folder
    """
    import os
    from pathlib import Path

    # Strip whitespace from path
    clean_path = request.folder_path.strip()
    folder_path = Path(clean_path)

    # Validate path exists
    if not folder_path.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {clean_path}")

    if not folder_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {clean_path}")

    results = {
        "imported": [],
        "errors": [],
        "folders_created": []
    }

    # Map of relative folder paths to folder IDs
    folder_map = {}

    # Find all .md files (case-insensitive)
    md_files = []
    if request.include_subfolders:
        md_files.extend(folder_path.rglob('*.md'))
        md_files.extend(folder_path.rglob('*.MD'))
        md_files.extend(folder_path.rglob('*.Md'))
    else:
        md_files.extend(folder_path.glob('*.md'))
        md_files.extend(folder_path.glob('*.MD'))
        md_files.extend(folder_path.glob('*.Md'))

    # Remove duplicates (in case filesystem is case-insensitive)
    md_files = list(set(md_files))

    # Filter out .obsidian folder only
    md_files = [f for f in md_files if '.obsidian' not in str(f)]

    print(f"[Import] Found {len(md_files)} .md files in {clean_path}")

    if len(md_files) == 0:
        return {
            "success": 0,
            "failed": 0,
            "folders_created": 0,
            "imported": [],
            "errors": [],
            "message": "No markdown files found in the specified folder"
        }

    for file_path in md_files:
        try:
            # Determine target folder
            target_folder = request.target_folder_id

            if request.preserve_structure:
                # Get relative path from vault root
                rel_path = file_path.relative_to(folder_path)
                parent_parts = rel_path.parent.parts

                if parent_parts:
                    # Create folder hierarchy
                    current_parent = None
                    current_path = ""

                    for part in parent_parts:
                        current_path = f"{current_path}/{part}" if current_path else part

                        if current_path not in folder_map:
                            # Check if folder already exists
                            existing = db.query(Folder).filter(
                                Folder.name == part,
                                Folder.parent_id == current_parent
                            ).first()

                            if existing:
                                folder_map[current_path] = existing.id
                            else:
                                # Create new folder
                                new_folder_id = str(uuid.uuid4())
                                new_folder = Folder(
                                    id=new_folder_id,
                                    name=part,
                                    parent_id=current_parent,
                                    created_at=datetime.utcnow(),
                                    updated_at=datetime.utcnow()
                                )
                                db.add(new_folder)
                                db.commit()
                                folder_map[current_path] = new_folder_id
                                results["folders_created"].append(part)

                        current_parent = folder_map[current_path]

                    target_folder = current_parent

            # Read and parse the file
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            post = frontmatter.loads(content)

            # Extract metadata
            title = post.get('title') or file_path.stem
            tags = post.get('tags', [])
            note_content = post.content

            # Generate unique ID
            note_id = str(uuid.uuid4())

            # Generate embedding
            try:
                # Strip base64 images for embedding
                clean_content = re.sub(r'!\[[^\]]*\]\(data:image/[^)]+\)', '[IMAGE]', note_content)
                if len(clean_content) > 4000:
                    clean_content = clean_content[:4000]
                embedding_text = f"{title}\n{clean_content}"
                embedding = get_embedding(embedding_text)
                embedding_json = json.dumps(embedding)
            except Exception as e:
                print(f"Warning: Could not generate embedding for {title}: {e}")
                embedding_json = None

            # Create note
            new_note = Note(
                id=note_id,
                title=title,
                content=note_content,
                tags=tags,
                embedding=embedding_json,
                embedding_model=MODEL_NAME,
                embedding_dimensions=MODEL_DIMENSIONS,
                embedding_status="ready" if embedding_json else "failed",
                folder_id=target_folder,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )

            db.add(new_note)
            db.commit()

            results["imported"].append({
                "id": note_id,
                "title": title,
                "filename": file_path.name,
                "folder_id": target_folder
            })

        except Exception as e:
            results["errors"].append({
                "filename": str(file_path),
                "error": str(e)
            })
            db.rollback()
            continue

    return {
        "success": len(results["imported"]),
        "failed": len(results["errors"]),
        "folders_created": len(results["folders_created"]),
        "imported": results["imported"],
        "errors": results["errors"]
    }

@app.get("/api/vault/preview")
def preview_vault_import(folder_path: str, include_subfolders: bool = True):
    """
    Preview what would be imported from a folder without actually importing.
    Returns file count and folder structure.
    """
    from pathlib import Path

    # Strip whitespace from path
    folder_path = folder_path.strip()
    path = Path(folder_path)

    if not path.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {folder_path}")

    if not path.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {folder_path}")

    # Find all .md files (case-insensitive - find both .md and .MD)
    md_files = []
    if include_subfolders:
        # Use rglob with both patterns for case sensitivity
        md_files.extend(path.rglob('*.md'))
        md_files.extend(path.rglob('*.MD'))
        md_files.extend(path.rglob('*.Md'))
    else:
        md_files.extend(path.glob('*.md'))
        md_files.extend(path.glob('*.MD'))
        md_files.extend(path.glob('*.Md'))

    # Remove duplicates (in case filesystem is case-insensitive)
    md_files = list(set(md_files))

    # Filter out .obsidian folder only (not all hidden folders - user might have valid folders)
    md_files = [f for f in md_files if '.obsidian' not in str(f)]

    print(f"[Preview] Found {len(md_files)} .md files in {folder_path}")

    # Get unique folders
    folders = set()
    for f in md_files:
        rel_path = f.relative_to(path)
        if rel_path.parent != Path('.'):
            folders.add(str(rel_path.parent))

    return {
        "file_count": len(md_files),
        "folder_count": len(folders),
        "folders": sorted(list(folders)),
        "files": [{"name": f.name, "path": str(f.relative_to(path))} for f in md_files[:50]],  # Preview first 50
        "has_more": len(md_files) > 50
    }

@app.get("/api/filesystem/browse")
def browse_filesystem(path: Optional[str] = None):
    """
    Browse the filesystem to help users select a folder.
    Returns list of directories at the given path.
    If no path provided, returns available drives (Windows) or root directories.
    """
    from pathlib import Path
    import platform

    result = {
        "current_path": "",
        "parent_path": None,
        "directories": [],
        "has_md_files": False,
        "md_file_count": 0
    }

    # If no path provided, return root/drives
    if not path:
        if platform.system() == 'Windows':
            # Get available drives on Windows
            import string
            drives = []
            for letter in string.ascii_uppercase:
                drive_path = f"{letter}:\\"
                if Path(drive_path).exists():
                    drives.append({
                        "name": f"{letter}:",
                        "path": drive_path,
                        "is_drive": True
                    })
            result["directories"] = drives
            result["current_path"] = ""
            return result
        else:
            # Unix-like systems start at root
            path = "/"

    # Normalize path
    folder_path = Path(path)

    if not folder_path.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {path}")

    if not folder_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {path}")

    result["current_path"] = str(folder_path)

    # Get parent path (if not at root)
    if folder_path.parent != folder_path:
        result["parent_path"] = str(folder_path.parent)

    # List directories (excluding hidden folders)
    try:
        directories = []
        for item in sorted(folder_path.iterdir()):
            if item.is_dir() and not item.name.startswith('.'):
                # Check if this directory has any .md files (for visual hint)
                try:
                    has_md = any(item.glob('*.md')) or any(item.rglob('*.md'))
                except PermissionError:
                    has_md = False

                directories.append({
                    "name": item.name,
                    "path": str(item),
                    "has_md_files": has_md
                })

        result["directories"] = directories

        # Check current folder for .md files
        try:
            md_files = list(folder_path.glob('*.md'))
            result["has_md_files"] = len(md_files) > 0
            result["md_file_count"] = len(md_files)

            # Also count recursively
            all_md_files = list(folder_path.rglob('*.md'))
            # Filter out hidden
            all_md_files = [f for f in all_md_files if not any(part.startswith('.') for part in f.parts)]
            result["total_md_count"] = len(all_md_files)
        except PermissionError:
            pass

    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied accessing: {path}")

    return result

# ============================================================================
# FILE UPLOAD ENDPOINT
# ============================================================================

@app.post("/api/upload")
async def upload_file(note_id: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Store note images by content hash; process bounded text files without filesystem access."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    content = await file.read(MAX_ATTACHMENT_BYTES + 1)
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
    try:
        if (file.content_type or "").lower().startswith("image/"):
            attachment = store_attachment(db, note, file.filename or "image", file.content_type, content, Path(ATTACHMENTS_PATH))
            db.commit()
            return {
                "success": True, "markdown": f"![{attachment.filename}](attachment://{attachment.id})",
                "type": "image", "filename": attachment.filename, "size": attachment.bytes,
                "metadata": {"attachment_id": attachment.id, "mime_type": attachment.mime_type, "sha256": attachment.sha256},
            }
        result = process_file(content, file.filename or "upload")
        return {
            "success": True, "markdown": result['markdown'], "type": result['type'],
            "filename": result['filename'], "size": result['size'],
            "metadata": {key: value for key, value in result.items() if key not in ['markdown', 'type', 'filename', 'size']},
        }
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/api/notes/{note_id:path}/attachments")
def list_note_attachments(note_id: str, db: Session = Depends(get_db)):
    if not db.query(Note).filter(Note.id == note_id).first():
        raise HTTPException(status_code=404, detail="Note not found")
    attachments = db.query(Attachment).filter(Attachment.note_id == note_id).order_by(Attachment.created_at).all()
    return {"attachments": [{
        "id": item.id, "note_id": item.note_id, "filename": item.filename,
        "mime_type": item.mime_type, "bytes": item.bytes, "sha256": item.sha256,
        "created_at": item.created_at.isoformat(),
    } for item in attachments]}


@app.get("/api/notes/{note_id:path}/versions")
def list_note_versions(note_id: str, db: Session = Depends(get_db)):
    if not db.query(Note).filter(Note.id == note_id).first():
        raise HTTPException(status_code=404, detail="Note not found")
    versions = db.query(NoteVersion).filter(NoteVersion.note_id == note_id).order_by(NoteVersion.version.desc()).all()
    return {"versions": [{
        "version": item.version, "title": item.title, "content": item.content,
        "tags": item.tags or [], "folder_id": item.folder_id,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    } for item in versions]}


@app.post("/api/notes/{note_id:path}/versions/{version}/restore")
def restore_note_version(note_id: str, version: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    stored = db.query(NoteVersion).filter(NoteVersion.note_id == note_id, NoteVersion.version == version).first()
    if not note or not stored:
        raise HTTPException(status_code=404, detail="Note or version not found")
    note.title, note.content, note.tags, note.folder_id = stored.title, stored.content, list(stored.tags or []), stored.folder_id
    note.current_version += 1
    note.updated_at = datetime.utcnow()
    for field, value in embedding_fields(note.title, note.content).items():
        setattr(note, field, value)
    record_note_version(db, note)
    db.commit()
    return {
        "id": note.id, "title": note.title, "content": note.content, "tags": note.tags,
        "folder_id": note.folder_id, "version": note.current_version,
        "embedding_status": note.embedding_status, "updated_at": note.updated_at.isoformat(),
    }


class SimilarityMatrixRequest(BaseModel):
    note_ids: List[str]


def ready_embedding(note: Note) -> list[float] | None:
    if note.embedding_status != "ready" or note.embedding_model != MODEL_NAME or note.embedding_dimensions != MODEL_DIMENSIONS:
        return None
    try:
        vector = json.loads(note.embedding)
    except (TypeError, json.JSONDecodeError):
        return None
    return vector if isinstance(vector, list) and len(vector) == MODEL_DIMENSIONS else None


@app.get("/api/notes/{note_id:path}/similar")
def get_similar_notes(note_id: str, limit: int = 5, db: Session = Depends(get_db)):
    if not 1 <= limit <= 20:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 20")
    source = db.query(Note).filter(Note.id == note_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Note not found")
    source_vector = ready_embedding(source)
    if source_vector is None:
        raise HTTPException(status_code=409, detail="Note embedding is unavailable or stale")
    results = []
    for note in db.query(Note).filter(Note.id != note_id, Note.embedding_status == "ready").all():
        vector = ready_embedding(note)
        if vector is not None:
            results.append({"id": note.id, "title": note.title, "score": cosine_similarity(source_vector, vector)})
    results.sort(key=lambda item: item["score"], reverse=True)
    return {"results": results[:limit], "model": MODEL_NAME, "dimensions": MODEL_DIMENSIONS}


@app.post("/api/notes/similarity-matrix")
def similarity_matrix(request: SimilarityMatrixRequest, db: Session = Depends(get_db)):
    note_ids = list(dict.fromkeys(request.note_ids))
    if not note_ids or len(note_ids) > 100:
        raise HTTPException(status_code=400, detail="Matrix requires 1 to 100 unique note IDs")
    notes = {note.id: note for note in db.query(Note).filter(Note.id.in_(note_ids)).all()}
    if len(notes) != len(note_ids):
        raise HTTPException(status_code=404, detail="One or more notes were not found")
    vectors = [ready_embedding(notes[note_id]) for note_id in note_ids]
    if any(vector is None for vector in vectors):
        raise HTTPException(status_code=409, detail="One or more note embeddings are unavailable or stale")
    matrix = [[cosine_similarity(left, right) for right in vectors] for left in vectors]
    return {"ids": note_ids, "matrix": matrix, "model": MODEL_NAME, "dimensions": MODEL_DIMENSIONS}


_embedding_workers = set()


def run_embedding_job(owner_id: str, job_id: str):
    from database import SessionLocal
    session = SessionLocal(owner_id=owner_id)
    try:
        job = session.query(EmbeddingJob).filter(EmbeddingJob.id == job_id).first()
        if not job:
            return
        job.status = "running"
        session.commit()
        while True:
            notes = session.query(Note).filter(Note.id > (job.last_note_id or "")).order_by(Note.id).limit(16).all()
            if not notes:
                job.status = "completed"
                job.updated_at = datetime.utcnow()
                session.commit()
                return
            failures = list(job.failures or [])
            for note in notes:
                fields = embedding_fields(note.title, note.content)
                for field, value in fields.items():
                    setattr(note, field, value)
                job.processed_count += 1
                if fields["embedding_status"] == "failed":
                    job.failed_count += 1
                    failures.append({"note_id": note.id, "error": fields["embedding_error"]})
                job.last_note_id = note.id
            job.failures = failures[-100:]
            job.updated_at = datetime.utcnow()
            session.commit()
    except Exception as error:
        session.rollback()
        job = session.query(EmbeddingJob).filter(EmbeddingJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.failures = [*(job.failures or []), {"note_id": job.last_note_id, "error": type(error).__name__}][-100:]
            job.updated_at = datetime.utcnow()
            session.commit()
    finally:
        session.close()
        _embedding_workers.discard(owner_id)


@app.post("/api/embeddings/reindex")
def start_embedding_reindex(db: Session = Depends(get_db)):
    owner_id = get_request_context().user_uuid
    if owner_id in _embedding_workers:
        raise HTTPException(status_code=409, detail="Embedding job already running")
    resumable = db.query(EmbeddingJob).filter(EmbeddingJob.status.in_(["running", "failed"])).order_by(EmbeddingJob.updated_at.desc()).first()
    job = resumable or EmbeddingJob(id=str(uuid.uuid4()), status="pending", model=MODEL_NAME, dimensions=MODEL_DIMENSIONS, failures=[])
    if resumable is None:
        db.add(job)
    else:
        job.status = "pending"
    db.commit()
    # simplification: one in-process worker per tenant; replace with a SQLite lease before multi-process workers.
    _embedding_workers.add(owner_id)
    threading.Thread(target=run_embedding_job, args=(owner_id, job.id), daemon=True).start()
    return {"job_id": job.id, "status": job.status}


@app.get("/api/embeddings/jobs/{job_id}")
def get_embedding_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(EmbeddingJob).filter(EmbeddingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Embedding job not found")
    return {
        "id": job.id, "status": job.status, "model": job.model, "dimensions": job.dimensions,
        "last_note_id": job.last_note_id, "processed_count": job.processed_count,
        "failed_count": job.failed_count, "failures": job.failures or [],
    }


# ============================================================================
# JOURNAL: CLIENTS, PROJECTS AND ENTRIES
# Declared above the notes catch-all so nested routes resolve first.
# ============================================================================

class ClientWrite(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    archived: Optional[bool] = None


class ProjectWrite(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    client_id: Optional[str] = None
    status: Literal["active", "paused", "done"] = "active"
    stale_after_days: int = Field(default=7, ge=1, le=365)


class AssignmentWrite(BaseModel):
    space: Literal["work", "personal"]
    project_id: Optional[str] = None


def client_payload(client: Client) -> dict:
    return {"id": client.id, "name": client.name, "archived": bool(client.archived), "created_at": client.created_at.isoformat() if client.created_at else None}


def project_payload(project: Project) -> dict:
    return {
        "id": project.id, "name": project.name, "client_id": project.client_id, "status": project.status,
        "stale_after_days": project.stale_after_days,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


def entry_row(note: Note) -> dict:
    return {
        "id": note.id, "title": note.title, "content": note.content,
        "excerpt": ' '.join((note.content or '').replace('\n', ' ').split())[:240],
        **entry_payload(note),
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
    }


@app.get("/api/clients")
def list_clients(include_archived: bool = False, db: Session = Depends(get_db)):
    query = db.query(Client)
    if not include_archived:
        query = query.filter(Client.archived == 0)
    return [client_payload(client) for client in query.order_by(Client.name).all()]


@app.post("/api/clients")
def create_client(payload: ClientWrite, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Client name is required")
    if db.query(Client).filter(Client.name == name).first():
        raise HTTPException(status_code=409, detail="Client name already exists")
    client = Client(id=str(uuid.uuid4()), name=name, archived=0, created_at=datetime.utcnow())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client_payload(client)


@app.put("/api/clients/{client_id}")
def update_client(client_id: str, payload: ClientWrite, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Client name is required")
    if db.query(Client).filter(Client.name == name, Client.id != client_id).first():
        raise HTTPException(status_code=409, detail="Client name already exists")
    client.name = name
    if payload.archived is not None:
        client.archived = 1 if payload.archived else 0
    db.commit()
    db.refresh(client)
    return client_payload(client)


@app.get("/api/projects")
def list_projects(status: Optional[Literal["active", "paused", "done"]] = None, client_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Project)
    if status:
        query = query.filter(Project.status == status)
    if client_id:
        query = query.filter(Project.client_id == client_id)
    return [project_payload(project) for project in query.order_by(Project.name).all()]


@app.post("/api/projects")
def create_project(payload: ProjectWrite, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required")
    if payload.client_id and not db.query(Client).filter(Client.id == payload.client_id).first():
        raise HTTPException(status_code=404, detail="Client not found")
    if db.query(Project).filter(Project.name == name).first():
        raise HTTPException(status_code=409, detail="Project name already exists")
    project = Project(
        id=str(uuid.uuid4()), name=name, client_id=payload.client_id, status=payload.status,
        stale_after_days=payload.stale_after_days, created_at=datetime.utcnow(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_payload(project)


@app.put("/api/projects/{project_id}")
def update_project(project_id: str, payload: ProjectWrite, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required")
    if payload.client_id and not db.query(Client).filter(Client.id == payload.client_id).first():
        raise HTTPException(status_code=404, detail="Client not found")
    if db.query(Project).filter(Project.name == name, Project.id != project_id).first():
        raise HTTPException(status_code=409, detail="Project name already exists")
    project.name = name
    project.client_id = payload.client_id
    project.status = payload.status
    project.stale_after_days = payload.stale_after_days
    db.commit()
    db.refresh(project)
    return project_payload(project)


@app.get("/api/projects/{project_id}/unlinked")
def project_unlinked_entries(project_id: str, limit: int = 50, db: Session = Depends(get_db)):
    """Entries naming this project in their text but not linked to it."""
    if not 1 <= limit <= 200:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 200")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    results = []
    for note in db.query(Note).filter(Note.kind == "entry", or_(Note.project_id.is_(None), Note.project_id != project_id)).order_by(Note.entry_date.desc()).all():
        match = next((hint for hint in name_hints(db, note) if hint["kind"] == "project" and hint["id"] == project_id), None)
        if match:
            results.append({**entry_row(note), "preview": match["preview"]})
        if len(results) >= limit:
            break
    return results


@app.get("/api/entries")
def list_entries(
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
    space: Optional[Literal["work", "personal"]] = None,
    project_id: Optional[str] = None,
    client_id: Optional[str] = None,
    assignment: Optional[Literal["manual", "rule", "ai", "unassigned"]] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    if not 1 <= limit <= 500:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 500")
    query = db.query(Note).filter(Note.kind == "entry")
    if from_date:
        query = query.filter(Note.entry_date >= from_date)
    if to_date:
        query = query.filter(Note.entry_date <= to_date)
    if space:
        query = query.filter(Note.space == space)
    if project_id:
        query = query.filter(Note.project_id == project_id)
    if client_id:
        query = query.join(Project, (Project.id == Note.project_id) & (Project.owner_id == Note.owner_id)).filter(Project.client_id == client_id)
    if assignment:
        query = query.filter(Note.assignment == assignment)
    entries = query.order_by(Note.entry_date.desc(), Note.created_at.desc()).limit(limit).all()
    return [entry_row(note) for note in entries]


@app.get("/api/entries/{entry_id}/hints")
def entry_hints(entry_id: str, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == entry_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"entry_id": note.id, "hints": name_hints(db, note)}


@app.put("/api/entries/{entry_id}/assignment")
def update_entry_assignment(entry_id: str, payload: AssignmentWrite, db: Session = Depends(get_db)):
    """Assign space and project; the response carries the previous values so the client can undo."""
    note = db.query(Note).filter(Note.id == entry_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Entry not found")
    previous = {"space": note.space, "project_id": note.project_id, "assignment": note.assignment}
    note.space = payload.space
    note.project_id = resolve_project(db, payload.project_id)
    note.assignment = "manual"
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return {**entry_row(note), "previous": previous}


def run_export_job(context, job_id: str) -> None:
    """Build the export zip off the request thread, tracking progress on the job row."""
    from database import SessionLocal
    from journal_export import export_archive

    def worker():
        session = SessionLocal()
        try:
            job = session.query(Job).filter(Job.id == job_id).first()
            if not job:
                return
            job.status = "running"
            job.attempts += 1
            job.updated_at = datetime.utcnow()
            session.commit()

            def progress(processed: int, total: int) -> None:
                job.processed_count = processed
                job.total_count = total
                job.updated_at = datetime.utcnow()
                session.commit()

            archive_path = export_archive(session, progress=progress)
            job.status = "done"
            job.result = {"path": str(archive_path), "bytes": archive_path.stat().st_size}
            job.updated_at = datetime.utcnow()
            session.commit()
        except Exception as error:
            session.rollback()
            failed = session.query(Job).filter(Job.id == job_id).first()
            if failed:
                failed.status = "failed"
                failed.error = type(error).__name__
                failed.updated_at = datetime.utcnow()
                session.commit()
        finally:
            session.close()

    run_with_request_context(context, worker)


@app.post("/api/exports")
def start_export(db: Session = Depends(get_db)):
    """Queue a full export; returns immediately so the proxy never waits on the zip."""
    job = Job(id=str(uuid.uuid4()), type="export", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(job)
    db.commit()
    db.refresh(job)
    threading.Thread(target=run_export_job, args=(get_request_context(), job.id), daemon=True).start()
    return {"id": job.id, "status": job.status, "processed_count": 0, "total_count": 0}


@app.get("/api/exports/{job_id}")
def get_export(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.type == "export").first()
    if not job:
        raise HTTPException(status_code=404, detail="Export not found")
    return {
        "id": job.id, "status": job.status, "processed_count": job.processed_count, "total_count": job.total_count,
        "error": job.error, "path": (job.result or {}).get("path"),
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


# Keep the path catch-all last so nested note routes resolve first.
@app.get("/api/notes/{note_id:path}")
def get_note(note_id: str, raw: bool = False, db: Session = Depends(get_db)):
    """Return a single note by its ID (relative path)."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    content_with_frontmatter = note.content
    if note.title or note.tags:
        frontmatter_lines = ["---"]
        if note.title:
            frontmatter_lines.append(f'title: "{note.title}"')
        if note.tags:
            frontmatter_lines.append("tags:")
            for tag in note.tags:
                frontmatter_lines.append(f'  - "{tag}"')
        frontmatter_lines.append("---")
        content_with_frontmatter = "\n".join(frontmatter_lines) + "\n" + note.content

    return {
        "id": note.id, "title": note.title, "content": note.content if raw else content_with_frontmatter, "tags": note.tags,
        "folder_id": note.folder_id, "version": note.current_version, "embedding_status": note.embedding_status,
        "embedding_model": note.embedding_model, "embedding_dimensions": note.embedding_dimensions,
        **entry_payload(note),
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
    }
