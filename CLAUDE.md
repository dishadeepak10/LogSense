# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

LogSense is a log anomaly detection and probable root-cause analysis platform (3rd-year ISE college mini project). Users upload an application log; the backend parses it, groups errors, detects anomalies, builds incidents, and an LLM returns "Probable Root Cause / Why / Suggested Action". Stack: FastAPI + SQLAlchemy + PostgreSQL (SQLite acceptable early on) + an external LLM API; the React/Tailwind/Recharts frontend is built separately.

**Early stage:** app setup (`config.py`, `database.py`, `main.py` with `GET /api/health`), `models.py`, and `POST /api/logs/upload` (validates and saves the file record only; no parsing yet) exist. Other routers and services are still empty files, and there are no tests or linter config yet. Do not assume existing implementations.

## Commands

Run from `backend/` (Windows, Git Bash paths shown):

```
python -m venv venv
./venv/Scripts/pip install -r requirements.txt
./venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Manual API testing is done through Swagger UI at http://localhost:8000/docs. With no `DATABASE_URL` set, the app uses SQLite at `backend/logsense.db` (gitignored); tables are created at startup from `models.py`.

## App wiring

- `app/config.py` is the single place that reads `.env` (repo root) and exposes `DATABASE_URL`, `MAX_UPLOAD_MB`, `CORS_ORIGINS`. Empty env values fall back to defaults. This is separate from Disha's `app/analysis/config.py`.
- `app/database.py` provides `engine`, `SessionLocal`, `Base` (SQLAlchemy 2.0 `DeclarativeBase`), and `get_db()` for use as a FastAPI dependency.
- `app/services/ingest.py` holds upload validation (`.log`/`.txt` only, non-empty, no NUL bytes in the first 8 KB) and `save_log_file`, which stores the SHA-256 hash. Routers turn its `InvalidLogFile` into an HTTP error using its `status_code`. Reuse it for sample loading so both paths follow the same rules. The size limit is enforced in `routers/logs.py` while reading the upload in chunks.
- `app/schemas.py` shapes are provisional until `docs/API_CONTRACT.md` exists. SQLite returns naive datetimes; schemas mark them as UTC via `as_utc` so the frontend doesn't misread them as local time. Apply it to every datetime field in responses.
- `app/main.py` imports `app.models` so every model is registered on `Base` before `create_all` runs in the lifespan hook. New routers must be added there with `app.include_router(...)`.

## Data model (`app/models.py`)

`LogFile` 1→many `LogEntry` and `Incident`; `Incident` 1→many `LogEntry` (via nullable `log_entries.incident_id`) and 1→1 `IncidentAnalysis` (table `incident_analysis`). Deleting a `LogFile` cascades to everything under it. Deliberate choices:
- `candidate_trigger` is stored as text + line number on `Incident`, not as a foreign key to `log_entries`, to avoid a circular reference between the two tables.
- `similar_incidents` is a JSON column holding Disha's result as returned.
- `service_timeline` is not stored; compute it from the incident's entries.
- `LogFile.content_hash` (SHA-256) is used to exclude identical files from similarity.
- There are no migrations: `create_all` only adds missing tables, so after changing a column delete `backend/logsense.db` and restart.

## Ownership and team rules

- Gourav (backend): `main.py`, `routers/`, `services/`, `models.py`, `schemas.py`, `database.py`.
- Disha (LLM and analysis): `backend/app/analysis/`. **Backend code must never edit this folder**; it only calls `detect_anomalies`, `analyze_incident`, `find_similar_incidents`, `decide_confidence`.
- Anusha (frontend + integration) owns `docs/API_CONTRACT.md`, the source of truth for every JSON shape. Changing a response shape requires telling Anusha first.
- Harsh: testing, `sample_logs/`, docs.
- One branch per task, pull request, teammate review. Never commit `.env` or API keys.

## Intended pipeline

1. **Upload** (`routers/logs.py`): validate file size (`MAX_UPLOAD_MB`) and type.
2. **Parse** (`services/parser.py`): regex parser; folds continuation lines (e.g. stack traces) into the previous entry and counts unparsed lines. Must not crash on a real Loghub log slice.
3. **Group** (`services/grouping.py`): group errors by message template; feeds the summary endpoint.
4. **Analyze** (calls into `analysis/`): anomaly detection, LLM root cause (with non-LLM fallback), similarity, confidence.
5. **Build incidents** (`services/incident_builder.py`): merge anomalies, categorize by keywords, assign severity by rules, pick a candidate trigger. Each incident also carries:
   - `service_timeline`: `[{service, first_error, error_count}]` computed from the incident's log entries.
   - `similar_incidents`: backend loads template sets of incidents from earlier uploads, passes them to `find_similar_incidents(...)`, then stores and returns `[{incident_id, file_name, similarity}]`.
   - `analysis.confidence` (`"high"`/`"low"`) from `decide_confidence(...)`, stored in `incident_analysis`.
6. **Serve** (`routers/incidents.py`, `services/report.py`): incident endpoints and report generation.

Samples: `GET /api/samples` lists files in `sample_logs/`; `POST /api/samples/{name}/load` runs the same pipeline as upload and returns the same response.

Out of scope until the team says the core is done: comparing two files, follow-up questions, thumbs up/down, JSON logs, Slack alerts.

## Agreed design decisions

- **LLM cap:** only the top N incidents by severity go to `analyze_incident`; the rest use Disha's non-LLM fallback. N is a config value (not yet chosen) so uploads stay fast.
- **Build order:** don't stub or guess Disha's function signatures. Build upload, parser, grouping, and DB first; wire in `analysis/` calls only after her code is merged.
- **Duplicate uploads:** store a content hash per uploaded file; before calling `find_similar_incidents`, exclude past incidents from files with the same hash so a re-upload doesn't match itself at 100%.
- **API contract:** `docs/API_CONTRACT.md` doesn't exist yet; Anusha will publish it. Don't invent response shapes ahead of it without checking with the user.

## Configuration

Copy `.env.example` to `.env` (gitignored) and fill in `DATABASE_URL`, `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `MAX_UPLOAD_MB` (default 10), `CORS_ORIGINS` (comma-separated; defaults to the Vite and CRA dev servers on localhost).
