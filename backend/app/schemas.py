"""Pydantic schemas: the exact JSON shapes the API sends.

PROVISIONAL: docs/API_CONTRACT.md doesn't exist yet. Check these against it
once Anusha publishes it, and tell her before changing any shape.

Times:
- Our own times (uploaded_at, created_at) are saved in UTC and returned with a "Z".
- Times read from the log (timestamps, start/end, first_error) are returned exactly
  as written in the log, without a timezone, because the log's timezone is unknown.
"""
from datetime import datetime, timezone

from pydantic import BaseModel, field_validator


def as_utc(value: datetime | None) -> datetime | None:
    """SQLite forgets timezones. We always save our own times in UTC, so mark naive
    ones as UTC; otherwise browsers would read them as local time."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class LogFileOut(BaseModel):
    id: int
    file_name: str
    size_bytes: int
    source: str  # "upload" or "sample"
    uploaded_at: datetime
    total_lines: int
    parsed_lines: int
    unparsed_lines: int
    incident_count: int

    @field_validator("uploaded_at")
    @classmethod
    def uploaded_at_in_utc(cls, value: datetime) -> datetime:
        return as_utc(value)


class LevelCounts(BaseModel):
    DEBUG: int
    INFO: int
    WARN: int
    ERROR: int
    FATAL: int


class TemplateGroupOut(BaseModel):
    template: str | None
    level: str
    count: int
    first_seen: datetime | None
    last_seen: datetime | None
    example: str | None


class TimelineBucket(BaseModel):
    time: datetime  # start of the bucket
    errors: int
    warnings: int


class SummaryOut(BaseModel):
    file_id: int
    file_name: str
    total_lines: int
    parsed_lines: int
    unparsed_lines: int
    entry_count: int
    level_counts: LevelCounts
    error_count: int
    warning_count: int
    services: list[str]
    start_time: datetime | None
    end_time: datetime | None
    incident_count: int
    top_error_groups: list[TemplateGroupOut]
    bucket_seconds: int  # width of each error_timeline bucket
    error_timeline: list[TimelineBucket]


class ServiceTimelineItem(BaseModel):
    service: str
    first_error: datetime | None
    error_count: int


class SimilarIncidentOut(BaseModel):
    incident_id: int
    file_name: str
    similarity: float  # 0.0 to 1.0


class AnalysisOut(BaseModel):
    root_cause: str
    why: str
    suggested_action: str
    confidence: str  # "high" or "low"
    source: str      # "llm" or "fallback"
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def created_at_in_utc(cls, value: datetime) -> datetime:
        return as_utc(value)


class IncidentOut(BaseModel):
    id: int
    file_id: int
    file_name: str
    title: str
    category: str
    severity: str  # "critical", "high", "medium", "low"
    start_time: datetime | None
    end_time: datetime | None
    error_count: int
    services: list[str]
    candidate_trigger: str | None
    candidate_trigger_line: int | None
    service_timeline: list[ServiceTimelineItem]
    similar_incidents: list[SimilarIncidentOut]
    analysis: AnalysisOut | None


class LogEntryOut(BaseModel):
    id: int
    line_number: int
    timestamp: datetime | None
    level: str | None
    service: str | None
    message: str
    raw: str


class IncidentDetailOut(IncidentOut):
    total_entries: int
    entries: list[LogEntryOut]  # first 200, in time order


class AnalysisResultOut(BaseModel):
    """Returned by upload and sample-load: everything the dashboard needs in one call."""
    file: LogFileOut
    summary: SummaryOut
    incidents: list[IncidentOut]


class SampleOut(BaseModel):
    name: str
    size_bytes: int
