"""Endpoints for uploading log files."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import MAX_UPLOAD_MB
from app.database import get_db
from app.schemas import LogFileOut
from app.services.ingest import InvalidLogFile, save_log_file

router = APIRouter(prefix="/api/logs", tags=["logs"])

MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
CHUNK_SIZE = 1024 * 1024  # read 1 MB at a time


def read_with_limit(upload: UploadFile) -> bytes:
    """Read the upload in chunks and stop as soon as it passes the size limit,
    instead of loading a huge file into memory first."""
    chunks, total = [], 0
    while chunk := upload.file.read(CHUNK_SIZE):
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"File is larger than {MAX_UPLOAD_MB} MB.")
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/upload", response_model=LogFileOut, status_code=201)
def upload_log(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a .log or .txt file. Parsing and analysis will be added in later steps."""
    data = read_with_limit(file)
    try:
        return save_log_file(db, file.filename or "", data, source="upload")
    except InvalidLogFile as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))
