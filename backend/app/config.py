"""Backend settings, read once from environment variables / the .env file."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Looks for a .env file starting from this file's folder and walking up,
# so the .env at the repo root is found.
load_dotenv()

# Empty values in .env count as "not set", so we fall back to defaults.
DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./logsense.db"
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB") or 10)

# Frontend addresses allowed to call this API from the browser.
# Default covers Vite (5173) and Create React App (3000) dev servers.
CORS_ORIGINS = [
    origin.strip()
    for origin in (os.getenv("CORS_ORIGINS") or "http://localhost:5173,http://localhost:3000").split(",")
    if origin.strip()
]

# Only the N most severe incidents per file go to the LLM; the rest use the
# non-LLM fallback. Keeps uploads fast (each LLM call can take seconds).
MAX_LLM_INCIDENTS = int(os.getenv("MAX_LLM_INCIDENTS") or 5)

# Folder listed by GET /api/samples. Default: sample_logs/ at the repo root.
SAMPLE_LOGS_DIR = Path(os.getenv("SAMPLE_LOGS_DIR") or Path(__file__).resolve().parents[2] / "sample_logs")
