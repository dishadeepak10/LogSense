"""File summary: line counts, level counts, top error groups, and errors over time (for the chart)."""
from __future__ import annotations

import math
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Incident, LogEntry, LogFile
from app.services.parser import ERROR_LEVELS

LEVELS = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]
TOP_GROUPS = 10
MAX_BUCKETS = 60
BUCKET_CHOICES = [1, 5, 10, 30, 60, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 604800]
_EPOCH = datetime(1970, 1, 1)


def _bucket_size(span_seconds: float) -> int:
    for size in BUCKET_CHOICES:
        if span_seconds / size <= MAX_BUCKETS:
            return size
    return math.ceil(span_seconds / MAX_BUCKETS)


def error_timeline(rows: list[tuple[datetime, str]], start: datetime | None, end: datetime | None) -> tuple[int, list[dict]]:
    """Count errors and warnings per time bucket from start to end. Empty buckets are included
    so the chart shows quiet periods. Bucket size is picked so there are at most ~60 bars."""
    if start is None or end is None:
        return 0, []
    size = _bucket_size((end - start).total_seconds())
    origin = int((start - _EPOCH).total_seconds()) // size * size  # round start down to a bucket edge
    count = int((end - _EPOCH).total_seconds() - origin) // size + 1
    errors, warnings = [0] * count, [0] * count
    for timestamp, level in rows:
        slot = min(max(int((timestamp - _EPOCH).total_seconds() - origin) // size, 0), count - 1)
        if level in ERROR_LEVELS:
            errors[slot] += 1
        else:
            warnings[slot] += 1
    return size, [
        {"time": _EPOCH + timedelta(seconds=origin + i * size), "errors": errors[i], "warnings": warnings[i]}
        for i in range(count)
    ]


def build_summary(db: Session, log_file: LogFile) -> dict:
    in_file = LogEntry.file_id == log_file.id

    level_counts = dict(db.execute(select(LogEntry.level, func.count()).where(in_file).group_by(LogEntry.level)).all())
    start, end = db.execute(select(func.min(LogEntry.timestamp), func.max(LogEntry.timestamp)).where(in_file)).one()
    services = db.scalars(
        select(LogEntry.service).where(in_file, LogEntry.service.is_not(None)).distinct().order_by(LogEntry.service)
    ).all()
    incident_count = db.scalar(select(func.count()).select_from(Incident).where(Incident.file_id == log_file.id))

    count = func.count().label("count")
    top_groups = db.execute(
        select(
            LogEntry.template, LogEntry.level, count,
            func.min(LogEntry.timestamp), func.max(LogEntry.timestamp), func.min(LogEntry.message),
        )
        .where(in_file, LogEntry.level.in_(ERROR_LEVELS))
        .group_by(LogEntry.template, LogEntry.level)
        .order_by(count.desc())
        .limit(TOP_GROUPS)
    ).all()

    problem_rows = db.execute(
        select(LogEntry.timestamp, LogEntry.level)
        .where(in_file, LogEntry.level.in_(["WARN", *ERROR_LEVELS]), LogEntry.timestamp.is_not(None))
    ).all()
    bucket_seconds, timeline = error_timeline(problem_rows, start, end)

    return {
        "file_id": log_file.id,
        "file_name": log_file.file_name,
        "total_lines": log_file.total_lines,
        "parsed_lines": log_file.parsed_lines,
        "unparsed_lines": log_file.unparsed_lines,
        "entry_count": sum(level_counts.values()),
        "level_counts": {level: level_counts.get(level, 0) for level in LEVELS},
        "error_count": sum(level_counts.get(level, 0) for level in ERROR_LEVELS),
        "warning_count": level_counts.get("WARN", 0),
        "services": list(services),
        "start_time": start,
        "end_time": end,
        "incident_count": incident_count,
        "top_error_groups": [
            {"template": t, "level": lvl, "count": c, "first_seen": first, "last_seen": last, "example": example}
            for t, lvl, c, first, last, example in top_groups
        ],
        "bucket_seconds": bucket_seconds,
        "error_timeline": timeline,
    }
