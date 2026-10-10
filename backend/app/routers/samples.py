"""Sample logs: list the files in sample_logs/ and analyze one with the upload pipeline."""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import MAX_UPLOAD_MB, SAMPLE_LOGS_DIR
from app.database import get_db
from app.routers.logs import MAX_UPLOAD_BYTES, analyze_bytes
from app.schemas import AnalysisResultOut, SampleOut
from app.services.ingest import ALLOWED_EXTENSIONS

router = APIRouter(prefix="/api/samples", tags=["samples"])


def sample_files() -> dict[str, Path]:
    """Name -> path for every allowed file directly inside the samples folder."""
    folder = Path(SAMPLE_LOGS_DIR)
    if not folder.is_dir():
        return {}
    return {
        path.name: path
        for path in sorted(folder.iterdir())
        if path.is_file() and path.suffix.lower() in ALLOWED_EXTENSIONS
    }


@router.get("", response_model=list[SampleOut])
def list_samples():
    return [{"name": name, "size_bytes": path.stat().st_size} for name, path in sample_files().items()]


@router.post("/{name}/load", response_model=AnalysisResultOut, status_code=201)
def load_sample(name: str, db: Session = Depends(get_db)):
    """Analyze a sample file exactly like an upload, and return the same response."""
    # Only names from the listing are accepted, so "../secret.txt" can never be read.
    path = sample_files().get(name)
    if path is None:
        raise HTTPException(status_code=404, detail=f"Sample '{name}' not found.")
    if path.stat().st_size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Sample is larger than {MAX_UPLOAD_MB} MB.")
    return analyze_bytes(db, name, path.read_bytes(), source="sample")
