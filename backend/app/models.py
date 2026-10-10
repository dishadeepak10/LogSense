"""Database tables. Each class below becomes one table.

How the tables connect:
    LogFile 1 ── many LogEntry      (every parsed line of the file)
    LogFile 1 ── many Incident      (problems found in the file)
    Incident 1 ── many LogEntry     (the lines that belong to that incident)
    Incident 1 ── 1 IncidentAnalysis (LLM or fallback result)
"""
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LogFile(Base):
    """One uploaded (or sample) log file and its parsing stats."""

    __tablename__ = "log_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    file_name: Mapped[str] = mapped_column(String(255))
    # SHA-256 of the file content. Lets similarity skip incidents from an identical file.
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(20), default="upload")  # "upload" or "sample"
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    total_lines: Mapped[int] = mapped_column(Integer, default=0)
    parsed_lines: Mapped[int] = mapped_column(Integer, default=0)
    unparsed_lines: Mapped[int] = mapped_column(Integer, default=0)

    # cascade: deleting a file also deletes its entries and incidents.
    entries: Mapped[list["LogEntry"]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )
    incidents: Mapped[list["Incident"]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )


class LogEntry(Base):
    """One parsed log record. Continuation lines (e.g. stack traces) are folded into `raw`."""

    __tablename__ = "log_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("log_files.id"), index=True)
    # Empty until the incident builder assigns this entry to an incident.
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id"), index=True)

    line_number: Mapped[int] = mapped_column(Integer)  # where the record starts in the file
    timestamp: Mapped[datetime | None] = mapped_column(DateTime)  # None if it couldn't be read
    level: Mapped[str | None] = mapped_column(String(10), index=True)  # ERROR, WARN, INFO...
    service: Mapped[str | None] = mapped_column(String(100))
    message: Mapped[str] = mapped_column(Text)
    # Message with variable parts (numbers, IDs, IPs) masked, used to group similar errors.
    template: Mapped[str | None] = mapped_column(Text, index=True)
    raw: Mapped[str] = mapped_column(Text)  # original text, including continuation lines

    file: Mapped["LogFile"] = relationship(back_populates="entries")
    incident: Mapped["Incident | None"] = relationship(back_populates="entries")


class Incident(Base):
    """A group of related errors the incident builder treats as one problem."""

    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("log_files.id"), index=True)

    title: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(50))  # from keyword rules, e.g. "database"
    severity: Mapped[str] = mapped_column(String(20))  # from severity rules, e.g. "high"
    start_time: Mapped[datetime | None] = mapped_column(DateTime)
    end_time: Mapped[datetime | None] = mapped_column(DateTime)
    error_count: Mapped[int] = mapped_column(Integer, default=0)

    # The log line we think started the incident (copied, so no link back to log_entries).
    candidate_trigger: Mapped[str | None] = mapped_column(Text)
    candidate_trigger_line: Mapped[int | None] = mapped_column(Integer)

    # Result of Disha's find_similar_incidents, stored as given:
    # [{"incident_id": ..., "file_name": ..., "similarity": ...}]
    similar_incidents: Mapped[list] = mapped_column(JSON, default=list)

    # service_timeline is NOT stored: it is computed from `entries` when needed.

    file: Mapped["LogFile"] = relationship(back_populates="incidents")
    entries: Mapped[list["LogEntry"]] = relationship(back_populates="incident")
    analysis: Mapped["IncidentAnalysis | None"] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )


class IncidentAnalysis(Base):
    """Probable root cause for one incident, from the LLM or the fallback."""

    __tablename__ = "incident_analysis"

    id: Mapped[int] = mapped_column(primary_key=True)
    # unique=True: at most one analysis per incident.
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), unique=True)

    root_cause: Mapped[str] = mapped_column(Text)
    why: Mapped[str] = mapped_column(Text)
    suggested_action: Mapped[str] = mapped_column(Text)
    confidence: Mapped[str] = mapped_column(String(10))  # "high" or "low", from decide_confidence
    source: Mapped[str] = mapped_column(String(20))  # "llm" or "fallback"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    incident: Mapped["Incident"] = relationship(back_populates="analysis")
