import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _inside(parent: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _resolve_inside(root: Path, relative: str) -> Path:
    resolved = (root / relative).resolve()
    if not _inside(root, resolved):
        raise ValueError(f"Path escapes root: {relative}")
    return resolved


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _inventory(connection: sqlite3.Connection) -> dict[str, int]:
    tables = connection.execute(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    counts: dict[str, int] = {}
    for (name,) in tables:
        identifier = '"' + name.replace('"', '""') + '"'
        counts[name] = connection.execute(f"SELECT COUNT(*) FROM {identifier}").fetchone()[0]
    return counts


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")


def create_backup(database_path: str | Path, attachments_path: str | Path, output_root: str | Path) -> tuple[Path, dict[str, Any]]:
    database = Path(database_path).resolve()
    attachments = Path(attachments_path).resolve()
    output = Path(output_root).resolve()
    if not database.is_file():
        raise FileNotFoundError(f"Database not found: {database}")
    if _inside(database.parent, output):
        raise ValueError("Backup output must be outside the live database directory")

    output.mkdir(parents=True, exist_ok=True)
    backup_directory = output / f"myob-{_timestamp()}"
    backup_directory.mkdir()
    backup_database = backup_directory / "notes.db"
    source = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    target = sqlite3.connect(backup_database)
    try:
        counts = _inventory(source)
        source.backup(target)
    finally:
        target.close()
        source.close()

    attachment_entries = []
    if attachments.exists():
        for source_file in sorted(path for path in attachments.rglob("*") if path.is_file()):
            if source_file.is_symlink():
                raise ValueError(f"Attachment symlink is not allowed: {source_file}")
            relative = source_file.relative_to(attachments)
            destination = _resolve_inside(backup_directory / "attachments", relative.as_posix())
            destination.parent.mkdir(parents=True, exist_ok=True)
            with source_file.open("rb") as source_stream, destination.open("xb") as destination_stream:
                shutil.copyfileobj(source_stream, destination_stream)
                destination_stream.flush()
                os.fsync(destination_stream.fileno())
            attachment_entries.append({"path": relative.as_posix(), "bytes": destination.stat().st_size, "sha256": _hash_file(destination)})

    manifest = {
        "formatVersion": 1,
        "service": "myob",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "database": {"path": "notes.db", "bytes": backup_database.stat().st_size, "sha256": _hash_file(backup_database), "counts": counts},
        "attachments": attachment_entries,
    }
    manifest_path = backup_directory / "manifest.json"
    with manifest_path.open("x", encoding="utf-8") as stream:
        json.dump(manifest, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    return backup_directory, manifest


def restore_backup(backup_directory: str | Path, target_directory: str | Path | None = None) -> tuple[Path, float]:
    started = time.perf_counter()
    backup_root = Path(backup_directory).resolve()
    target_root = Path(target_directory).resolve() if target_directory else Path(f"{backup_root}-restore-{_timestamp()}")
    if target_root.exists():
        raise FileExistsError(f"Restore target already exists: {target_root}")
    manifest = json.loads(_resolve_inside(backup_root, "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("formatVersion") != 1 or manifest.get("service") != "myob":
        raise ValueError("Unsupported backup manifest")
    backup_database = _resolve_inside(backup_root, manifest["database"]["path"])
    if _hash_file(backup_database) != manifest["database"]["sha256"]:
        raise ValueError("Backup database hash mismatch")

    target_root.mkdir(parents=False)
    try:
        restored_database = target_root / "notes.db"
        source = sqlite3.connect(f"file:{backup_database.as_posix()}?mode=ro", uri=True)
        target = sqlite3.connect(restored_database)
        try:
            source.backup(target)
        finally:
            target.close()
            source.close()
        restored = sqlite3.connect(restored_database)
        try:
            if _inventory(restored) != manifest["database"]["counts"]:
                raise ValueError("Restored database row counts do not match manifest")
        finally:
            restored.close()

        for entry in manifest["attachments"]:
            source_file = _resolve_inside(backup_root / "attachments", entry["path"])
            if _hash_file(source_file) != entry["sha256"]:
                raise ValueError(f"Backup attachment hash mismatch: {entry['path']}")
            destination = _resolve_inside(target_root / "attachments", entry["path"])
            destination.parent.mkdir(parents=True, exist_ok=True)
            with source_file.open("rb") as source_stream, destination.open("xb") as destination_stream:
                shutil.copyfileobj(source_stream, destination_stream)
                destination_stream.flush()
                os.fsync(destination_stream.fileno())
            if _hash_file(destination) != entry["sha256"]:
                raise ValueError(f"Restored attachment hash mismatch: {entry['path']}")
    except Exception:
        shutil.rmtree(target_root, ignore_errors=True)
        raise
    return target_root, (time.perf_counter() - started) * 1000


def preflight_migration(database_path: str | Path, attachments_path: str | Path, output_root: str | Path, target_directory: str | Path | None = None, legacy_owner: str | None = None) -> dict[str, Any]:
    from migration_runner import apply_migrations

    backup_directory, _manifest = create_backup(database_path, attachments_path, output_root)
    restored_target, elapsed_ms = restore_backup(backup_directory, target_directory)
    restored_database = restored_target / "notes.db"
    applied = apply_migrations(restored_database, legacy_owner=legacy_owner)
    connection = sqlite3.connect(restored_database)
    try:
        counts = _inventory(connection)
    finally:
        connection.close()
    return {
        "backupDirectory": str(backup_directory),
        "targetDirectory": str(restored_target),
        "elapsedMs": elapsed_ms,
        "appliedMigrations": applied,
        "counts": counts,
        "databaseSha256": _hash_file(restored_database),
    }


def main() -> None:
    from config import DB_PATH

    parser = argparse.ArgumentParser(description="Back up or restore MyOb data")
    subparsers = parser.add_subparsers(dest="command", required=True)
    backup = subparsers.add_parser("backup")
    backup.add_argument("--database", default=DB_PATH)
    backup.add_argument("--attachments", default=str(Path(DB_PATH).parent / "attachments"))
    backup.add_argument("--output", default=str(Path(DB_PATH).parent.parent / "backups"))
    restore = subparsers.add_parser("restore")
    restore.add_argument("--backup", required=True)
    restore.add_argument("--target")
    preflight = subparsers.add_parser("preflight")
    preflight.add_argument("--database", default=DB_PATH)
    preflight.add_argument("--attachments", default=str(Path(DB_PATH).parent / "attachments"))
    preflight.add_argument("--output", default=str(Path(DB_PATH).parent.parent / "backups"))
    preflight.add_argument("--target")
    preflight.add_argument("--legacy-owner")
    args = parser.parse_args()

    if args.command == "backup":
        directory, manifest = create_backup(args.database, args.attachments, args.output)
        print(json.dumps({"backupDirectory": str(directory), "manifest": manifest}))
    elif args.command == "restore":
        target, elapsed_ms = restore_backup(args.backup, args.target)
        print(json.dumps({"targetDirectory": str(target), "elapsedMs": elapsed_ms}))
    else:
        print(json.dumps(preflight_migration(args.database, args.attachments, args.output, args.target, args.legacy_owner)))


if __name__ == "__main__":
    main()
