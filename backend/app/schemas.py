"""Pydantic schemas: the exact JSON shapes the API sends and receives.

PROVISIONAL: docs/API_CONTRACT.md doesn't exist yet. Check these against it
once Anusha publishes it.
"""
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_validator


def as_utc(value: datetime) -> datetime:
    """SQLite forgets timezones. We always save UTC, so mark naive times as UTC;
    otherwise browsers would read them as local time."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class LogFileOut(BaseModel):
    # Lets Pydantic read fields straight from a SQLAlchemy LogFile object.
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    size_bytes: int
    source: str
    uploaded_at: datetime

    @field_validator("uploaded_at")
    @classmethod
    def uploaded_at_in_utc(cls, value: datetime) -> datetime:
        return as_utc(value)
