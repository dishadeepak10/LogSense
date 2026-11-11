"""Checks a log file's content and creates its LogFile row.

Used by both the upload endpoint and the sample-load endpoint (through the
pipeline), so both follow exactly the same rules.
"""
import hashlib
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import LogFile

ALLOWED_EXTENSIONS = {".log", ".txt"}


class InvalidLogFile(ValueError):
    """Raised when a file must be rejected. `status_code` says which HTTP error fits."""

    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def validate_log_file(file_name: str, data: bytes) -> None:
    """Reject files that are empty, have the wrong extension, or aren't text."""
    extension = Path(file_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise InvalidLogFile(
            f"Only {', '.join(sorted(ALLOWED_EXTENSIONS))} files are accepted, got '{extension or 'no extension'}'.",
            status_code=415,
        )
    if not data.strip():
        raise InvalidLogFile("The file is empty.", status_code=400)
    # Text files never contain a zero byte; images, zips and programs almost always do.
    # Checking the first 8 KB is enough and stays fast on big files.
    if b"\x00" in data[:8192]:
        raise InvalidLogFile("The file looks binary, not a text log.", status_code=415)


def create_log_file(db: Session, file_name: str, data: bytes, source: str = "upload") -> LogFile:
    """Add a LogFile row for already-validated data. The caller commits."""
    log_file = LogFile(
        file_name=Path(file_name).name,  # drop any folder part a client might send
        content_hash=hashlib.sha256(data).hexdigest(),
        size_bytes=len(data),
        source=source,
    )
    db.add(log_file)
    db.flush()  # sends the INSERT so log_file.id is available, without committing yet
    return log_file
