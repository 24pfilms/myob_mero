import argparse
import base64
import binascii
import hashlib
import os
import re
import uuid
from datetime import datetime
from pathlib import Path

from config import ATTACHMENTS_PATH
from database import Attachment, AttachmentMigrationJob, Note, NoteVersion, SessionLocal

MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
DATA_IMAGE = re.compile(r"!\[([^\]]*)\]\(data:(image/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\s]+)\)", re.IGNORECASE)
MAGIC = {
    "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "image/gif": lambda data: data.startswith((b"GIF87a", b"GIF89a")),
    "image/webp": lambda data: len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP",
}


def validate_image(mime_type: str, content: bytes) -> bytes:
    normalized = mime_type.lower()
    if normalized not in MAGIC:
        raise ValueError("Attachment MIME type is not allowed")
    if not content or len(content) > MAX_ATTACHMENT_BYTES or not MAGIC[normalized](content):
        raise ValueError("Attachment content does not match its MIME type")
    return content


def decode_image(mime_type: str, encoded: str) -> bytes:
    if len(encoded) > ((MAX_ATTACHMENT_BYTES + 2) // 3) * 4 + 4096:
        raise ValueError("Attachment exceeds the byte limit")
    try:
        content = base64.b64decode("".join(encoded.split()), validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("Attachment base64 is invalid") from error
    return validate_image(mime_type, content)


def durable_write(root: Path, digest: str, extension: str, content: bytes) -> Path:
    root = root.resolve()
    destination = (root / digest[:2] / f"{digest}.{extension}").resolve()
    if root not in destination.parents:
        raise ValueError("Attachment path escaped the storage root")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
            raise ValueError("Stored attachment hash mismatch")
        return destination
    temporary = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("xb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, destination)
        try:
            directory = os.open(destination.parent, os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        except OSError:
            pass
    finally:
        temporary.unlink(missing_ok=True)
    return destination


def store_attachment(session, note: Note, filename: str, mime_type: str, content: bytes, attachment_root: Path) -> Attachment:
    content = validate_image(mime_type, content)
    digest = hashlib.sha256(content).hexdigest()
    extension = "jpg" if mime_type.lower() == "image/jpeg" else mime_type.lower().split("/", 1)[1]
    destination = durable_write(attachment_root, digest, extension, content)
    attachment_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{note.owner_id}:{note.id}:{digest}"))
    attachment = session.query(Attachment).filter(Attachment.id == attachment_id).first()
    if attachment:
        return attachment
    attachment = Attachment(
        owner_id=note.owner_id, id=attachment_id, note_id=note.id, sha256=digest,
        filename=Path(filename).name or destination.name, mime_type=mime_type.lower(), bytes=len(content),
        storage_path=destination.relative_to(attachment_root.resolve()).as_posix(),
    )
    session.add(attachment)
    return attachment


def migrate_note(session, note: Note, attachment_root: Path) -> int:
    def replace(match: re.Match) -> str:
        mime_type = match.group(2).lower()
        content = decode_image(mime_type, match.group(3))
        attachment = store_attachment(session, note, f"inline.{mime_type.split('/', 1)[1]}", mime_type, content, attachment_root)
        return f"![{match.group(1)}](attachment://{attachment.id})"

    updated_content, replacements = DATA_IMAGE.subn(replace, note.content)
    if not replacements:
        return 0
    next_version = note.current_version + 1
    session.add(NoteVersion(
        owner_id=note.owner_id, id=str(uuid.uuid4()), note_id=note.id, version=next_version,
        title=note.title, content=updated_content, tags=list(note.tags or []), folder_id=note.folder_id,
    ))
    note.content = updated_content
    note.current_version = next_version
    note.updated_at = datetime.utcnow()
    session.commit()
    return replacements


def run_job(owner_id: str, job_id: str | None = None, attachment_root: Path | None = None, batch_size: int = 16) -> AttachmentMigrationJob:
    if not 1 <= batch_size <= 100:
        raise ValueError("Batch size must be between 1 and 100")
    session = SessionLocal(owner_id=owner_id)
    try:
        job = session.query(AttachmentMigrationJob).filter(AttachmentMigrationJob.id == job_id).first() if job_id else None
        if not job:
            job = AttachmentMigrationJob(owner_id=owner_id, id=job_id or str(uuid.uuid4()), status="pending", failures=[])
            session.add(job)
            session.commit()
        job.status = "running"
        session.commit()
        while True:
            notes = session.query(Note).filter(Note.id > (job.last_note_id or "")).order_by(Note.id).limit(batch_size).all()
            if not notes:
                job.status = "completed"
                session.commit()
                session.refresh(job)
                session.expunge(job)
                return job
            for note in notes:
                note_id = note.id
                try:
                    migrate_note(session, note, attachment_root or Path(ATTACHMENTS_PATH))
                    job = session.query(AttachmentMigrationJob).filter(AttachmentMigrationJob.id == job.id).first()
                    job.processed_count += 1
                except Exception as error:
                    session.rollback()
                    job = session.query(AttachmentMigrationJob).filter(AttachmentMigrationJob.id == job.id).first()
                    job.failed_count += 1
                    job.failures = [*(job.failures or []), {"note_id": note_id, "error": str(error)}][-100:]
                job.last_note_id = note_id
                job.updated_at = datetime.utcnow()
                session.commit()
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="Migrate inline base64 note images into content-addressed attachment files")
    parser.add_argument("--owner", required=True)
    parser.add_argument("--resume-job")
    parser.add_argument("--attachments", default=ATTACHMENTS_PATH)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()
    job = run_job(args.owner, args.resume_job, Path(args.attachments), args.batch_size)
    print(f"job={job.id} status={job.status} processed={job.processed_count} failed={job.failed_count}")


if __name__ == "__main__":
    main()
