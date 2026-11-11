# LogSense

Log anomaly detection and probable root-cause analysis platform (college mini project, 3rd year ISE).

Upload an application log: the backend parses it, groups similar errors, detects anomalies (error spike,
burst, first-time error), builds incidents, and an LLM explains each one as
**Probable Root Cause / Why / Suggested Action**, with a confidence badge, a failure timeline per service
and "seen before" matches from earlier files. Works without an API key (rule-based fallback).

## Team
- Anusha: Frontend + Integration (`frontend/`, `docs/API_CONTRACT.md`)
- Gourav: Backend (`backend/` except `app/analysis/`)
- Disha: LLM and Analysis (`backend/app/analysis/`, `sample_logs/`)
- Harsh: Testing, sample data and documentation

## Stack
React + Tailwind + Recharts, FastAPI, PostgreSQL (SQLite by default), LLM API (Claude, or any OpenAI-compatible API)

## Run it locally (two terminals)

1. Settings (optional): copy `.env.example` to `.env` and fill in `LLM_API_KEY` to use the LLM.
   Leave it empty to use the rule-based fallback. **Never commit `.env`.**
2. Backend:
   ```
   cd backend
   python -m venv venv
   venv\Scripts\pip install -r requirements-dev.txt
   venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
   ```
   API docs: http://localhost:8000/docs
3. Frontend:
   ```
   cd frontend
   npm install
   npm run dev
   ```
   Open http://localhost:5173 and click **Load sample log**.

## Tests and evaluation
```
cd backend
venv\Scripts\python -m pytest -q          # all backend + analysis tests
venv\Scripts\python scripts/evaluate.py   # sample logs vs expected results -> docs/EVALUATION.md
```

## Docs
- `docs/API_CONTRACT.md`: JSON shapes (single source of truth)
- `docs/ANALYSIS_VIVA_NOTES.md`: how the detectors, LLM client, confidence and similarity work
- `docs/EVALUATION.md`: evaluation results table
- `TODO.md`: what is still open (start here)
