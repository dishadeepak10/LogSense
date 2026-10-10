"""Turns database rows into the plain dicts the API returns (shapes are in schemas.py)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Incident, LogEntry, LogFile
from app.services.incident_builder import rank_key, service_timeline
from app.services.summary import build_summary

ENTRY_LIMIT = 200  # max log lines returned in an incident's detail view


def file_to_dict(log_file: LogFile, incident_count: int) -> dict:
    return {
        "id": log_file.id,
        "file_name": log_file.file_name,
        "size_bytes": log_file.size_bytes,
        "source": log_file.source,
        "uploaded_at": log_file.uploaded_at,
        "total_lines": log_file.total_lines,
        "parsed_lines": log_file.parsed_lines,
        "unparsed_lines": log_file.unparsed_lines,
        "incident_count": incident_count,
    }


def entry_to_dict(entry: LogEntry) -> dict:
    return {
        "id": entry.id,
        "line_number": entry.line_number,
        "timestamp": entry.timestamp,
        "level": entry.level,
        "service": entry.service,
        "message": entry.message,
        "raw": entry.raw,
    }


def incident_to_dict(incident: Incident, include_entries: bool = False) -> dict:
    entries = sorted(incident.entries, key=lambda e: (e.timestamp or datetime.min, e.line_number))
    analysis = incident.analysis
    data = {
        "id": incident.id,
        "file_id": incident.file_id,
        "file_name": incident.file.file_name,
        "title": incident.title,
        "category": incident.category,
        "severity": incident.severity,
        "start_time": incident.start_time,
        "end_time": incident.end_time,
        "error_count": incident.error_count,
        "services": sorted({e.service for e in entries if e.service}),
        "candidate_trigger": incident.candidate_trigger,
        "candidate_trigger_line": incident.candidate_trigger_line,
        "service_timeline": service_timeline(entries),
        "similar_incidents": incident.similar_incidents or [],
        "analysis": None if analysis is None else {
            "root_cause": analysis.root_cause,
            "why": analysis.why,
            "suggested_action": analysis.suggested_action,
            "confidence": analysis.confidence,
            "source": analysis.source,
            "created_at": analysis.created_at,
        },
    }
    if include_entries:
        data["total_entries"] = len(entries)
        data["entries"] = [entry_to_dict(e) for e in entries[:ENTRY_LIMIT]]
    return data


def _incident_query():
    return select(Incident).options(
        selectinload(Incident.entries), selectinload(Incident.analysis), joinedload(Incident.file)
    )


def file_incidents(db: Session, file_id: int) -> list[dict]:
    incidents = db.scalars(_incident_query().where(Incident.file_id == file_id)).unique().all()
    return [incident_to_dict(i) for i in sorted(incidents, key=rank_key)]


def get_incident(db: Session, incident_id: int) -> dict | None:
    incident = db.scalars(_incident_query().where(Incident.id == incident_id)).unique().one_or_none()
    return None if incident is None else incident_to_dict(incident, include_entries=True)


def analysis_result(db: Session, log_file: LogFile) -> dict:
    """The full response for upload and sample-load: file, summary, and incidents."""
    incidents = file_incidents(db, log_file.id)
    return {
        "file": file_to_dict(log_file, len(incidents)),
        "summary": build_summary(db, log_file),
        "incidents": incidents,
    }


def list_files(db: Session) -> list[dict]:
    counts = dict(db.execute(select(Incident.file_id, func.count()).group_by(Incident.file_id)).all())
    files = db.scalars(select(LogFile).order_by(LogFile.id.desc())).all()
    return [file_to_dict(f, counts.get(f.id, 0)) for f in files]
