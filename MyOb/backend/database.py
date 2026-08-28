from sqlalchemy import create_engine, Column, String, Text, JSON, Index, DateTime, Integer, event
from sqlalchemy.orm import Session as SQLAlchemySession, sessionmaker, declarative_base, with_loader_criteria
from datetime import datetime
from config import DB_CONNECTION_STRING, DB_PATH
from migration_runner import BUSY_TIMEOUT_MS, apply_migrations

Base = declarative_base()


class TenantOwned:
    owner_id = Column(String, primary_key=True, nullable=False)


class Note(TenantOwned, Base):
    __tablename__ = 'notes'
    
    id = Column(String, primary_key=True)  # Unique note ID (now UUID-based, but kept as string for compatibility)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)  # Full markdown content including frontmatter
    tags = Column(JSON, default=list)
    embedding = Column(Text)  # Store as a JSON string of a list of floats
    embedding_model = Column(String, nullable=True)
    embedding_dimensions = Column(Integer, nullable=True)
    embedding_status = Column(String, nullable=False, default='missing')
    embedding_error = Column(Text, nullable=True)
    current_version = Column(Integer, nullable=False, default=1)
    folder_id = Column(String, nullable=True)  # Reference to parent folder
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_notes_title', 'title'),
        Index('idx_notes_folder_id', 'folder_id'),
        Index('idx_notes_created_at', 'created_at'),
    )

class NoteVersion(TenantOwned, Base):
    __tablename__ = 'note_versions'

    id = Column(String, primary_key=True)
    note_id = Column(String, nullable=False)
    version = Column(Integer, nullable=False)
    title = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(JSON, nullable=True)
    folder_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Folder(TenantOwned, Base):
    __tablename__ = 'folders'
    
    id = Column(String, primary_key=True)  # Unique folder ID
    name = Column(String, nullable=False)  # Folder name
    parent_id = Column(String, nullable=True)  # Reference to parent folder
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_folders_parent_id', 'parent_id'),
        Index('idx_folders_name', 'name'),
    )

class VideoSummary(TenantOwned, Base):
    __tablename__ = 'video_summaries'
    
    video_id = Column(String, primary_key=True)
    note_id = Column(String, nullable=False)
    title = Column(String)
    summary = Column(Text)
    transcript = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_video_note_id', 'note_id'),
    )

class ImportJob(TenantOwned, Base):
    __tablename__ = 'import_jobs'
    
    id = Column(String, primary_key=True)  # UUID for job
    status = Column(String, nullable=False)  # pending, processing, completed, failed
    total_items = Column(JSON, default=0)
    completed_items = Column(JSON, default=0)
    failed_items = Column(JSON, default=0)
    results = Column(JSON, default=list)  # Array of {url, status, note_id, error}
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_import_jobs_status', 'status'),
        Index('idx_import_jobs_created_at', 'created_at'),
    )

class Conversation(TenantOwned, Base):
    __tablename__ = 'conversations'
    
    id = Column(String, primary_key=True)  # UUID
    title = Column(String, nullable=True)  # Optional conversation title
    note_id = Column(String, nullable=True)  # If conversation saved as note
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_conversations_created_at', 'created_at'),
        Index('idx_conversations_note_id', 'note_id'),
    )

class ConversationMessage(TenantOwned, Base):
    __tablename__ = 'conversation_messages'
    
    id = Column(String, primary_key=True)  # UUID
    conversation_id = Column(String, nullable=False)  # Reference to conversation
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    citations = Column(JSON, default=list)  # Array of citation objects
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_messages_conversation_id', 'conversation_id'),
        Index('idx_messages_created_at', 'created_at'),
    )

class NoteLink(TenantOwned, Base):
    __tablename__ = 'note_links'
    
    id = Column(String, primary_key=True)  # UUID
    source_note_id = Column(String, nullable=False)
    target_note_id = Column(String, nullable=False)
    link_type = Column(String, default='explicit')  # 'explicit', 'ai_suggested', 'auto_detected'
    confidence_score = Column(JSON, default=0.0)  # For AI-suggested links
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_links_source', 'source_note_id'),
        Index('idx_links_target', 'target_note_id'),
        Index('idx_links_type', 'link_type'),
    )

class AISuggestion(TenantOwned, Base):
    __tablename__ = 'ai_suggestions'
    
    id = Column(String, primary_key=True)  # UUID
    note_id = Column(String, nullable=False)
    suggestion_type = Column(String, nullable=False)  # 'link', 'tag', 'structure'
    suggestion_data = Column(JSON, nullable=False)  # Suggestion details
    status = Column(String, default='pending')  # 'pending', 'accepted', 'rejected'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_suggestions_note_id', 'note_id'),
        Index('idx_suggestions_status', 'status'),
        Index('idx_suggestions_type', 'suggestion_type'),
    )

class GeneratedImage(TenantOwned, Base):
    __tablename__ = 'generated_images'
    
    id = Column(String, primary_key=True)  # UUID
    note_id = Column(String, nullable=True)  # Optional FK to note (allows orphan gallery images)
    prompt = Column(Text, nullable=False)  # Original generation prompt
    image_data = Column(Text, nullable=False)  # Base64 encoded image
    thumbnail_data = Column(Text, nullable=True)  # Smaller base64 thumbnail for gallery
    mime_type = Column(String, default='image/png')  # MIME type
    aspect_ratio = Column(String, default='1:1')  # Aspect ratio (1:1, 16:9, etc.)
    
    # Gallery-ready metadata
    tags = Column(JSON, default=list)  # Array of tag strings
    category = Column(String, nullable=True)  # Category for organization
    is_favorite = Column(JSON, default=False)  # Boolean for favorites
    display_order = Column(JSON, default=0)  # Int for manual ordering
    generation_params = Column(JSON, default=dict)  # Store model, settings, etc.
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_generated_images_note_id', 'note_id'),
        Index('idx_generated_images_created_at', 'created_at'),
        Index('idx_generated_images_is_favorite', 'is_favorite'),
        Index('idx_generated_images_category', 'category'),
    )

class ImageCollection(TenantOwned, Base):
    __tablename__ = 'image_collections'
    
    id = Column(String, primary_key=True)  # UUID
    name = Column(String, nullable=False)  # Collection name
    description = Column(Text, nullable=True)  # Optional description
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_image_collections_created_at', 'created_at'),
    )

class ImageCollectionMembership(TenantOwned, Base):
    __tablename__ = 'image_collection_memberships'
    
    id = Column(String, primary_key=True)  # UUID
    collection_id = Column(String, nullable=False)  # FK to ImageCollection
    image_id = Column(String, nullable=False)  # FK to GeneratedImage
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_memberships_collection_id', 'collection_id'),
        Index('idx_memberships_image_id', 'image_id'),
    )

class EmbeddingJob(TenantOwned, Base):
    __tablename__ = 'embedding_jobs'

    id = Column(String, primary_key=True)
    status = Column(String, nullable=False, default='pending')
    model = Column(String, nullable=False)
    dimensions = Column(Integer, nullable=False)
    last_note_id = Column(String, nullable=True)
    processed_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    failures = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Attachment(TenantOwned, Base):
    __tablename__ = 'attachments'

    id = Column(String, primary_key=True)
    note_id = Column(String, nullable=False)
    sha256 = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    bytes = Column(Integer, nullable=False)
    storage_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AttachmentMigrationJob(TenantOwned, Base):
    __tablename__ = 'attachment_migration_jobs'

    id = Column(String, primary_key=True)
    status = Column(String, nullable=False, default='pending')
    last_note_id = Column(String, nullable=True)
    processed_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    failures = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AISettings(TenantOwned, Base):
    __tablename__ = 'ai_settings'
    
    id = Column(String, primary_key=True, default='default')  # Single row for now
    
    # Feature toggles
    ai_chat_enabled = Column(JSON, default=True)  # Enable/disable AI chat
    link_suggestions_enabled = Column(JSON, default=True)  # Enable/disable link suggestions while typing
    auto_tag_enabled = Column(JSON, default=False)  # Enable/disable auto-tagging
    
    # AI Model settings
    chat_model = Column(String, default='anthropic/claude-3.5-sonnet')  # LLM model for chat
    temperature = Column(JSON, default=0.7)  # Creativity level (0-1)
    max_context_notes = Column(JSON, default=5)  # Number of notes to include as context
    
    # Privacy settings
    send_full_content = Column(JSON, default=False)  # Send full notes vs excerpts
    exclude_private_tags = Column(JSON, default=True)  # Exclude notes with #private tag
    save_conversations = Column(JSON, default=True)  # Save conversation history
    
    # Performance settings
    link_suggestion_debounce = Column(JSON, default=500)  # Milliseconds to wait before suggesting
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

apply_migrations(DB_PATH)
engine = create_engine(DB_CONNECTION_STRING, connect_args={"timeout": BUSY_TIMEOUT_MS / 1000})

@event.listens_for(engine, "connect")
def configure_sqlite_connection(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
        cursor.execute("PRAGMA foreign_keys = ON")
    finally:
        cursor.close()

class TenantSession(SQLAlchemySession):
    def __init__(self, *args, owner_id=None, **kwargs):
        if owner_id is None:
            try:
                from security import get_request_context
                owner_id = get_request_context().user_uuid
            except RuntimeError:
                owner_id = None
        super().__init__(*args, **kwargs)
        self.info["owner_id"] = owner_id


@event.listens_for(TenantSession, "do_orm_execute")
def scope_tenant_statements(execute_state):
    if not (execute_state.is_select or execute_state.is_update or execute_state.is_delete):
        return
    owner_id = execute_state.session.info.get("owner_id")
    if not owner_id:
        raise RuntimeError("Tenant owner is required for MyOb data access")
    execute_state.statement = execute_state.statement.options(
        with_loader_criteria(TenantOwned, lambda model: model.owner_id == owner_id, include_aliases=True)
    )


@event.listens_for(TenantSession, "before_flush")
def enforce_tenant_writes(session, _flush_context, _instances):
    owner_id = session.info.get("owner_id")
    if not owner_id and any(isinstance(item, TenantOwned) for item in session.new | session.dirty | session.deleted):
        raise RuntimeError("Tenant owner is required for MyOb data writes")
    for item in session.new:
        if isinstance(item, TenantOwned):
            if item.owner_id not in (None, owner_id):
                raise RuntimeError("Cross-tenant write denied")
            item.owner_id = owner_id
    for item in session.dirty:
        if isinstance(item, TenantOwned) and item.owner_id != owner_id:
            raise RuntimeError("Cross-tenant write denied")


SessionLocal = sessionmaker(class_=TenantSession, autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Provides a tenant-scoped database session for API requests."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()