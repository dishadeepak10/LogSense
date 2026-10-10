# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LogSense is a log anomaly detection and probable root-cause analysis platform (3rd-year ISE college mini project). Users upload an application log; the backend parses it, groups errors, detects anomalies, builds incidents, and an LLM returns "Probable Root Cause / Why / Suggested Action". Stack: FastAPI + SQLAlchemy 2.0 + PostgreSQL (SQLite by default) + an external LLM API called only from Disha's `app/analysis/`. The React/Tailwind/Recharts frontend is built separately.

The backend pipeline is complete. `app/analysis/` (Disha's) is still empty, so the backend currently runs on placeholders in `services/analysis_adapter.py` (see below).

## Commands

Run from `backend/` (Windows, Git Bash paths shown; use backslashes in PowerShell):

```
python -m venv venv
./venv/Scripts/pip install -r requirements-dev.txt        # requirements.txt + pytest + httpx2
./venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
./venv/Scripts/python -m pytest -q                        # all tests
./venv/Scripts/python -m pytest -q tests/test_parser.py -k loghub   # one file / subset
./venv/Scripts/python scripts/check_parser.py             # parse every Loghub fixture and print stats
```

Manual API testing is done through Swagger UI at http://localhost:8000/docs. With no `DATABASE_URL`, the app uses SQLite at `backend/logsense.db` (gitignored). For PostgreSQL use `postgresql+psycopg://user:pass@host/db`. There are no migrations: `create_all` only adds missing tables, so after changing a column, delete `logsense.db` and restart.

Tests use a throwaway SQLite DB and `tests/fixtures/samples/` as the samples folder; `tests/conftest.py` sets those env vars before importing the app because `config.py` reads env once at import. Starlette's test client uses `httpx2` (plain `httpx` triggers a deprecation warning).

## Pipeline (`services/pipeline.py: run_pipeline`)

Upload (`POST /api/logs/upload`) and `POST /api/samples/{name}/load` both call `run_pipeline`, then return `views.analysis_result` (`{file, summary, incidents}`):

1. `ingest.validate_log_file`: `.log`/`.txt`, non-empty, no NUL byte in the first 8 KB. Raises `InvalidLogFile(status_code)`; routers turn it into an HTTP error via `routers/logs.analyze_bytes`. The size limit is enforced while reading in chunks (`routers/logs.read_with_limit`) or by `stat()` for samples.
2. `parser.parse_log`: ordered list of regex formats (generic app logs plus all 16 Loghub datasets); the last matched format moves to the front. Unmatched lines are continuation lines (indented, `at `, `Caused by:`, `XxxError:`…) appended to the previous entry's `raw`, or counted as unparsed. Invariant: `total_lines == parsed_lines + unparsed_lines` (blank lines ignored). Levels are normalized to DEBUG/INFO/WARN/ERROR/FATAL, guessed from keywords when the format has none. Formats without a year assume the current year.
3. `grouping.make_template`: masks UUIDs, IPs, hex, and any token containing a digit. **Must stay deterministic across uploads**: similarity compares template sets between files.
4. `analysis_adapter.detect_anomalies` → `incident_builder.build_incidents`: merge anomalies within 5 min (or 50 lines), category by keyword hits on the trigger plus the first 5 errors' raw text (earliest errors are closest to the cause), severity rules in `decide_severity`, trigger = earliest entry. Sorted most severe first, capped at 50.
5. Persist in one transaction: `LogFile`, then `Incident`s (flush for ids), then all entries with one bulk `insert(LogEntry)`.
6. For each incident: `find_similar_incidents` against `load_past_incidents` (other files, **excluding identical `content_hash`**), `analyze_incident(context, use_llm=rank < MAX_LLM_INCIDENTS)`, `decide_confidence`. Commit.

`service_timeline` and an incident's `services` list are computed on read from its entries (`views.incident_to_dict`), never stored.

## Disha's analysis code: `services/analysis_adapter.py`

The only backend file that touches `app/analysis/`. It looks up `detect_anomalies`, `analyze_incident`, `find_similar_incidents`, `decide_confidence` by name in any `app.analysis` module, calls them positionally with the inputs documented in its docstring, validates results, and falls back on any missing function, exception, or malformed result:
- anomalies: placeholder error-burst clustering (2+ errors within 60 s, or one FATAL, plus preceding WARNs from the same services)
- analysis: rule-based text per category, `source="fallback"`
- similarity: `[]` (backend must not implement matching)
- confidence: `"low"`

When Disha's signatures land and differ, change only this file. The adapter's interface is a proposal she hasn't confirmed yet.

## Endpoints

`GET /api/health` · `POST /api/logs/upload` · `GET /api/logs` · `GET /api/logs/{id}` · `GET /api/logs/{id}/summary` · `GET /api/logs/{id}/incidents` · `GET /api/logs/{id}/report` (Markdown download) · `GET /api/incidents/{id}` (adds first 200 entries) · `GET /api/samples` · `POST /api/samples/{name}/load` (name must be in the listing: blocks path traversal).

Shapes live in `schemas.py` and are **provisional** until `docs/API_CONTRACT.md` exists. Times: our own (`uploaded_at`, `created_at`) are UTC and marked with `as_utc` (SQLite drops tz info); times read from logs are returned naive, as written in the log.

## Data model (`app/models.py`)

`LogFile` 1→many `LogEntry` and `Incident`; `Incident` 1→many `LogEntry` (nullable `log_entries.incident_id`) and 1→1 `IncidentAnalysis`. Deleting a `LogFile` cascades. `candidate_trigger` is stored as text + line number (not a FK) to avoid a circular reference; `similar_incidents` is a JSON column.

## Ownership and team rules

- Gourav (backend): everything in `backend/` except `app/analysis/`.
- Disha (LLM and analysis): `backend/app/analysis/`. **Never edit this folder.**
- Anusha (frontend + integration) owns `docs/API_CONTRACT.md`, the source of truth for JSON shapes. Tell her before changing a response shape.
- Harsh: testing, `sample_logs/`, docs. `sample_logs/` currently holds a synthetic demo log and Loghub's Hadoop_2k slice added by backend for the samples endpoint.
- One branch per task, pull request, teammate review. Never commit `.env` or API keys.
- Out of scope until the team says the core is done: comparing two files, follow-up questions, thumbs up/down, JSON logs, Slack alerts.

## Configuration

Copy `.env.example` (repo root) to `.env` and fill in as needed. Read only by `app/config.py` (separate from Disha's `app/analysis/config.py`); empty values fall back to defaults: `DATABASE_URL` (SQLite), `MAX_UPLOAD_MB` (10), `CORS_ORIGINS` (Vite 5173 + CRA 3000 on localhost), `MAX_LLM_INCIDENTS` (5), `SAMPLE_LOGS_DIR` (repo `sample_logs/`). `LLM_*` variables are for Disha's code.
