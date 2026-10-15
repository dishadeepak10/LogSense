# LogSense API contract

**Owner:** Anusha (frontend + integration). This file is the single source of truth for JSON shapes.
Backend (`backend/app/schemas.py`) and frontend (`frontend/src/mock/`) must match it.
**Changing a shape?** Open a PR that edits this file first, get it reviewed, then change the code.

- Base URL (dev): `http://localhost:8000`. Every path starts with `/api`.
- Interactive docs: `http://localhost:8000/docs` (Swagger UI).
- CORS allows `http://localhost:5173` (Vite) and `http://localhost:3000`.
- Version: 1.0 (2026-10-15)

## Conventions

| Topic | Rule |
|---|---|
| Times **we** create (`uploaded_at`, `created_at`) | ISO 8601 in UTC with `Z`, e.g. `"2026-10-15T14:07:34.873324Z"`. Show in the user's local time. |
| Times **read from the log** (`timestamp`, `start_time`, `end_time`, `first_error`, `first_seen`, `last_seen`, `time`) | ISO 8601 **without** timezone, e.g. `"2026-10-01T09:20:50.204000"`, exactly as written in the log. Show as-is; do not convert time zones. |
| Missing values | `null` (never omitted). Log timestamps can be `null` when a line had no readable time. |
| Errors | JSON `{"detail": "human readable message"}` (for 422 validation errors `detail` is a list; show a generic message). |
| Ordering | Incidents: most severe first, then most errors. Files: newest first. Entries: time order. |

### Enums

| Field | Values |
|---|---|
| `severity` | `"critical"`, `"high"`, `"medium"`, `"low"` |
| `category` | `"database"`, `"memory"`, `"disk"`, `"network"`, `"auth"`, `"config"`, `"hardware"`, `"application"` |
| `analysis.confidence` | `"high"` (LLM and rules agree) or `"low"` (disagree, or no LLM was used: "verify manually") |
| `analysis.source` | `"llm"` or `"fallback"` (rule-based, used when there is no API key or the LLM failed) |
| `file.source` | `"upload"` or `"sample"` |
| entry `level` | `"DEBUG"`, `"INFO"`, `"WARN"`, `"ERROR"`, `"FATAL"` |

## Endpoints

| Method | Path | Returns | Errors |
|---|---|---|---|
| GET | `/api/health` | `{"status": "ok"}` | |
| POST | `/api/logs/upload` (multipart, field `file`) | **201** `AnalysisResult` | 400 empty file, 413 too large (> 10 MB), 415 wrong type (only `.log`, `.txt`) or binary, 422 no file |
| GET | `/api/logs` | `LogFile[]` (history) | |
| GET | `/api/logs/{file_id}` | `AnalysisResult` (reopen an earlier file) | 404 |
| GET | `/api/logs/{file_id}/summary` | `Summary` | 404 |
| GET | `/api/logs/{file_id}/incidents` | `Incident[]` | 404 |
| GET | `/api/logs/{file_id}/report` | Markdown file download (`text/markdown`, `Content-Disposition: attachment; filename="logsense-report-{id}.md"`) | 404 |
| GET | `/api/incidents/{incident_id}` | `IncidentDetail` | 404 |
| GET | `/api/samples` | `Sample[]` | |
| POST | `/api/samples/{name}/load` | **201** `AnalysisResult` (same as upload) | 404 unknown name, 413 |

Upload and sample-load can take a few seconds (the LLM is called for up to 5 incidents): show a loading state.

## Shapes

### AnalysisResult (upload, sample load, reopen)
```json
{ "file": LogFile, "summary": Summary, "incidents": [Incident] }
```

### LogFile
```json
{
  "id": 2,
  "file_name": "payment_service_demo.log",
  "size_bytes": 18616,
  "source": "sample",
  "uploaded_at": "2026-10-15T14:07:34.873324Z",
  "total_lines": 225,
  "parsed_lines": 224,
  "unparsed_lines": 1,
  "incident_count": 2
}
```
`total_lines == parsed_lines + unparsed_lines` (blank lines are not counted; stack-trace lines are folded into the line above).

### Summary
```json
{
  "file_id": 2,
  "file_name": "payment_service_demo.log",
  "total_lines": 225, "parsed_lines": 224, "unparsed_lines": 1,
  "entry_count": 215,
  "level_counts": {"DEBUG": 55, "INFO": 137, "WARN": 4, "ERROR": 18, "FATAL": 1},
  "error_count": 19,
  "warning_count": 4,
  "services": ["api-gateway", "auth-service", "db-proxy", "order-service", "payment-service"],
  "start_time": "2026-10-01T09:00:00.049000",
  "end_time": "2026-10-01T09:52:51.359000",
  "incident_count": 2,
  "top_error_groups": [
    {
      "template": "Upstream payment-service returned <*> for POST /api/payments in <*>",
      "level": "ERROR", "count": 6,
      "first_seen": "2026-10-01T09:21:18.950000", "last_seen": "2026-10-01T09:22:20.683000",
      "example": "Upstream payment-service returned 503 for POST /api/payments in 30140ms"
    }
  ],
  "bucket_seconds": 60,
  "error_timeline": [{"time": "2026-10-01T09:20:00", "errors": 2, "warnings": 2}]
}
```
- `error_count` = ERROR + FATAL. `top_error_groups`: up to 10, largest first.
- `error_timeline`: one bucket per `bucket_seconds` from start to end, empty buckets included (max ~60 bars). `errors` = ERROR+FATAL, `warnings` = WARN. Empty list when the log has no timestamps.

### Incident
```json
{
  "id": 3,
  "file_id": 2,
  "file_name": "payment_service_demo.log",
  "title": "Database issue: Could not get JDBC connection: pool exhausted after <*> ms",
  "category": "database",
  "severity": "high",
  "start_time": "2026-10-01T09:20:32.620000",
  "end_time": "2026-10-01T09:22:35.365000",
  "error_count": 15,
  "services": ["api-gateway", "order-service", "payment-service"],
  "candidate_trigger": "2026-10-01 09:20:32,620 WARN  [payment-service] Slow query took 4200 ms: ...",
  "candidate_trigger_line": 79,
  "service_timeline": [
    {"service": "payment-service", "first_error": "2026-10-01T09:20:50.204000", "error_count": 6},
    {"service": "order-service",   "first_error": "2026-10-01T09:20:57.826000", "error_count": 3},
    {"service": "api-gateway",     "first_error": "2026-10-01T09:21:18.950000", "error_count": 6}
  ],
  "similar_incidents": [
    {"incident_id": 1, "file_name": "small_app.log", "similarity": 0.43}
  ],
  "analysis": {
    "root_cause": "The database was unreachable, overloaded, or ran out of connections.",
    "why": "Rule-based guess from keywords (category: database). 15 errors from ...",
    "suggested_action": "1) Check that the database is up ... 2) ... 3) ...",
    "confidence": "low",
    "source": "fallback",
    "created_at": "2026-10-15T14:07:34.880121Z"
  }
}
```
- `service_timeline` (failure timeline): one row per service, sorted by `first_error` (who broke first). Services that only logged warnings have `first_error: null`, `error_count: 0` and come last.
- `similar_incidents` ("seen before"): Jaccard similarity of error-template sets, 0.0 to 1.0, threshold 0.3, max 5, best first. Can be `[]`. Identical re-uploads are never listed.
- `analysis` can be `null` (should not happen in practice; show "No analysis available").
- `candidate_trigger` is the earliest line of the incident (often a WARN), only its first line.

### IncidentDetail = Incident plus
```json
{
  "total_entries": 16,
  "entries": [
    {
      "id": 88, "line_number": 80, "timestamp": "2026-10-01T09:20:50.204000",
      "level": "ERROR", "service": "payment-service",
      "message": "Could not get JDBC connection: pool exhausted after 30000 ms",
      "raw": "2026-10-01 09:20:50,204 ERROR [payment-service] Could not get JDBC ...\njava.sql.SQLTransientConnectionException: ...\n\tat ..."
    }
  ]
}
```
`entries`: first 200 lines of the incident in time order; `total_entries` is the full count. `raw` may contain newlines (stack traces).

### Sample
```json
{"name": "payment_service_demo.log", "size_bytes": 18616}
```

## Analysis functions (backend ↔ analysis handshake)

Called only from `backend/app/services/analysis_adapter.py`. If a function is missing, crashes, or returns a bad value, the adapter falls back so uploads never fail.

| Function (module) | Arguments | Returns |
|---|---|---|
| `detect_anomalies(entries, groups)` (anomaly.py) | `entries`: `[{index, line_number, timestamp, level, service, message, template}]`; `groups`: template groups | `[{"entry_indices": [int], "reason": str}]` |
| `analyze_incident(incident, use_llm)` (llm_client.py) | incident context (see `pipeline.incident_context`), `use_llm` False beyond the top 5 | `{"root_cause", "why", "suggested_action", "source": "llm" or "fallback"}` |
| `find_similar_incidents(new_templates, past_incidents)` (similarity.py) | `[str]`, `[{"incident_id", "file_name", "templates": [str]}]` | `[{"incident_id", "file_name", "similarity"}]` |
| `decide_confidence(llm_root_cause_text, rule_category)` (confidence.py) | str, str | `"high"` or `"low"`. Only called for `source == "llm"`; fallback answers are always `"low"`. |

## Change log
- 1.0 (2026-10-15): first version, matches `schemas.py` on `Gourav_BackEnd` plus the analysis module.
