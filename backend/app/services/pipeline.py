"""Runs the full analysis for one log file. Upload and sample-load both call run_pipeline().

    validate -> parse -> templates/groups -> detect anomalies -> build incidents
    -> save file, incidents, entries -> similar incidents, analysis, confidence -> commit

Everything is saved in one transaction: if any step fails, nothing is stored.
"""
from __future__ import annotations

from collections import Counter

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.config import MAX_LLM_INCIDENTS
from app.models import Incident, IncidentAnalysis, LogEntry, LogFile
from app.services import analysis_adapter
from app.services.grouping import add_templates, group_entries
from app.services.incident_builder import BuiltIncident, build_incidents, service_timeline
from app.services.ingest import create_log_file, validate_log_file
from app.services.parser import ParsedEntry, parse_log

PAST_INCIDENT_LIMIT = 200  # how many earlier incidents similarity looks at
SAMPLE_LINES = 200         # raw lines given to the analysis per incident (guide asks 20-40; pass more so evidence builder can pick the best)


def entry_dict(entry: ParsedEntry) -> dict:
    return {
        "index": entry.index,
        "line_number": entry.line_number,
        "timestamp": entry.timestamp,
        "level": entry.level,
        "service": entry.service,
        "message": entry.message,
        "template": entry.template,
    }


def incident_context(built: BuiltIncident, entries: list[ParsedEntry]) -> dict:
    """Everything the analysis functions get to know about one incident."""
    members = [entries[i] for i in built.entry_indices]
    counts = Counter(e.template or e.message for e in members)
    return {
        "title": built.title,
        "category": built.category,
        "severity": built.severity,
        "error_count": built.error_count,
        "start_time": built.start_time,
        "end_time": built.end_time,
        "services": built.services,
        "candidate_trigger": built.candidate_trigger,
        "candidate_trigger_line": built.candidate_trigger_line,
        "templates": [{"template": t, "count": counts[t]} for t in built.templates[:10]],
        "service_timeline": service_timeline(members),
        "sample_lines": [e.raw[:1000] for e in members[:SAMPLE_LINES]],
        "reasons": built.reasons,
    }


def load_past_incidents(db: Session, current: LogFile) -> list[dict]:
    """Template sets of recent incidents from OTHER files, skipping files identical to this one."""
    recent_ids = db.scalars(
        select(Incident.id)
        .join(LogFile, Incident.file_id == LogFile.id)
        .where(LogFile.id != current.id, LogFile.content_hash != current.content_hash)
        .order_by(Incident.id.desc())
        .limit(PAST_INCIDENT_LIMIT)
    ).all()
    if not recent_ids:
        return []
    rows = db.execute(
        select(Incident.id, LogFile.file_name, LogEntry.template)
        .join(LogFile, Incident.file_id == LogFile.id)
        .join(LogEntry, LogEntry.incident_id == Incident.id)
        .where(Incident.id.in_(recent_ids))
        .distinct()
    ).all()
    by_id: dict[int, dict] = {}
    for incident_id, file_name, template in rows:
        item = by_id.setdefault(incident_id, {"incident_id": incident_id, "file_name": file_name, "templates": set()})
        if template:
            item["templates"].add(template)
    return [{**item, "templates": sorted(item["templates"])} for item in by_id.values()]


def run_pipeline(db: Session, file_name: str, data: bytes, source: str = "upload") -> LogFile:
    validate_log_file(file_name, data)  # raises InvalidLogFile

    # 1. Parse and group (all in memory, nothing saved yet)
    text = data.decode("utf-8-sig", errors="replace")  # -sig drops a BOM; bad bytes become "?"
    parsed = parse_log(text)
    entries = parsed.entries
    add_templates(entries)
    groups = group_entries(entries)

    # 2. Anomalies -> incidents (already sorted most severe first)
    anomalies = analysis_adapter.detect_anomalies([entry_dict(e) for e in entries], [g.as_dict() for g in groups])
    built_incidents = build_incidents(entries, anomalies)

    try:
        # 3. Save the file, its incidents, and its entries
        log_file = create_log_file(db, file_name, data, source)
        log_file.total_lines = parsed.total_lines
        log_file.parsed_lines = parsed.parsed_lines
        log_file.unparsed_lines = parsed.unparsed_lines

        incidents = [
            Incident(
                file_id=log_file.id,
                title=b.title,
                category=b.category,
                severity=b.severity,
                start_time=b.start_time,
                end_time=b.end_time,
                error_count=b.error_count,
                candidate_trigger=b.candidate_trigger,
                candidate_trigger_line=b.candidate_trigger_line,
                similar_incidents=[],
            )
            for b in built_incidents
        ]
        db.add_all(incidents)
        db.flush()  # gives every incident its id

        incident_id_of_entry = {
            index: incident.id for b, incident in zip(built_incidents, incidents) for index in b.entry_indices
        }
        rows = [
            {
                "file_id": log_file.id,
                "incident_id": incident_id_of_entry.get(e.index),
                "line_number": e.line_number,
                "timestamp": e.timestamp,
                "level": e.level,
                "service": e.service,
                "message": e.message,
                "template": e.template,
                "raw": e.raw,
            }
            for e in entries
        ]
        if rows:
            db.execute(insert(LogEntry), rows)  # one bulk insert instead of thousands of single ones

        # 4. Similar incidents, root cause, confidence (top N get the LLM)
        past_incidents = load_past_incidents(db, log_file)
        for rank, (built, incident) in enumerate(zip(built_incidents, incidents)):
            context = incident_context(built, entries)
            incident.similar_incidents = analysis_adapter.find_similar_incidents(built.templates, past_incidents)
            analysis = analysis_adapter.analyze_incident(context, rank < MAX_LLM_INCIDENTS)
            incident.analysis = IncidentAnalysis(
                root_cause=analysis["root_cause"],
                why=analysis["why"],
                suggested_action=analysis["suggested_action"],
                source=analysis["source"],
                confidence=analysis_adapter.decide_confidence(context, analysis),
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(log_file)
    return log_file
