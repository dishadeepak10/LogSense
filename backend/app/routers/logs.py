"""Endpoints for log files: upload, history, summary, incidents, and report."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import MAX_UPLOAD_MB
from app.database import get_db
from app.models import LogFile
from app.schemas import AnalysisResultOut, IncidentOut, LogFileOut, SummaryOut
from app.services.ingest import InvalidLogFile
from app.services.pipeline import run_pipeline
from app.services.report import build_markdown_report
from app.services.summary import build_summary
from app.services.views import analysis_result, file_incidents, list_files

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


def analyze_bytes(db: Session, file_name: str, data: bytes, source: str) -> dict:
    """Run the pipeline and turn validation problems into HTTP errors. Shared with samples."""
    try:
        log_file = run_pipeline(db, file_name, data, source=source)
    except InvalidLogFile as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))
    return analysis_result(db, log_file)


def get_file_or_404(db: Session, file_id: int) -> LogFile:
    log_file = db.get(LogFile, file_id)
    if log_file is None:
        raise HTTPException(status_code=404, detail=f"Log file {file_id} not found.")
    return log_file


@router.post("/upload", response_model=AnalysisResultOut, status_code=201)
def upload_log(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a .log or .txt file and run the full analysis."""
    data = read_with_limit(file)
    return analyze_bytes(db, file.filename or "", data, source="upload")


@router.get("", response_model=list[LogFileOut])
def list_log_files(db: Session = Depends(get_db)):
    """Every analyzed file, newest first."""
    return list_files(db)


@router.get("/{file_id}", response_model=AnalysisResultOut)
def get_log_file(file_id: int, db: Session = Depends(get_db)):
    """The same result upload returned, for reopening an earlier file."""
    return analysis_result(db, get_file_or_404(db, file_id))


@router.get("/{file_id}/summary", response_model=SummaryOut)
def get_summary(file_id: int, db: Session = Depends(get_db)):
    return build_summary(db, get_file_or_404(db, file_id))


@router.get("/{file_id}/incidents", response_model=list[IncidentOut])
def get_file_incidents(file_id: int, db: Session = Depends(get_db)):
    """Incidents of one file, most severe first."""
    get_file_or_404(db, file_id)
    return file_incidents(db, file_id)


@router.get("/{file_id}/report", response_class=Response,
            responses={200: {"content": {"text/markdown": {}}, "description": "Markdown report file"}})
def download_report(file_id: int, db: Session = Depends(get_db)):
    """Download a Markdown report of the file's summary and incidents."""
    log_file = get_file_or_404(db, file_id)
    return Response(
        content=build_markdown_report(db, log_file),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="logsense-report-{file_id}.md"'},
    )
