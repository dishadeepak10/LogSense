"""Template grouping: makes similar messages look identical so they can be counted together.

    "Connection to 10.0.0.5:5432 timed out after 3000 ms"
    "Connection to 10.0.0.7:5432 timed out after 2500 ms"
both become the template
    "Connection to <IP> timed out after <*> ms"

The masking rules must stay the same across uploads, because Disha's similarity
code compares template sets of incidents from different files.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime

from app.services.parser import ParsedEntry

MAX_TEMPLATE_LENGTH = 500

_MASKS = [
    (re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"), "<UUID>"),
    (re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b"), "<IP>"),
    (re.compile(r"\b0x[0-9a-fA-F]+\b"), "<HEX>"),
    (re.compile(r"\b(?=[0-9a-fA-F]*\d)(?=[0-9a-fA-F]*[a-fA-F])[0-9a-fA-F]{8,}\b"), "<HEX>"),  # long hex ids
]
_HAS_DIGIT = re.compile(r"\d")


def make_template(message: str) -> str:
    """Mask the parts of a message that change between otherwise identical lines."""
    text = message
    for pattern, replacement in _MASKS:
        text = pattern.sub(replacement, text)
    # Any remaining word that contains a digit (ids, counts, durations, ports) becomes <*>.
    tokens = [
        token if token.startswith("<") and token.endswith(">") or not _HAS_DIGIT.search(token) else "<*>"
        for token in text.split()
    ]
    return " ".join(tokens)[:MAX_TEMPLATE_LENGTH]


def add_templates(entries: list[ParsedEntry]) -> None:
    for entry in entries:
        entry.template = make_template(entry.message)


@dataclass
class TemplateGroup:
    template: str
    level: str
    count: int = 0
    first_seen: datetime | None = None
    last_seen: datetime | None = None
    services: set[str] = field(default_factory=set)
    example: str = ""
    entry_indices: list[int] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "template": self.template,
            "level": self.level,
            "count": self.count,
            "first_seen": self.first_seen.isoformat() if self.first_seen else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "services": sorted(self.services),
            "example": self.example,
            "entry_indices": self.entry_indices,
        }


def group_entries(entries: list[ParsedEntry]) -> list[TemplateGroup]:
    """One group per (template, level), largest first."""
    groups: dict[tuple[str, str], TemplateGroup] = {}
    for entry in entries:
        key = (entry.template or "", entry.level)
        group = groups.get(key)
        if group is None:
            group = groups[key] = TemplateGroup(template=key[0], level=entry.level, example=entry.message[:500])
        group.count += 1
        group.entry_indices.append(entry.index)
        if entry.service:
            group.services.add(entry.service)
        if entry.timestamp:
            if group.first_seen is None or entry.timestamp < group.first_seen:
                group.first_seen = entry.timestamp
            if group.last_seen is None or entry.timestamp > group.last_seen:
                group.last_seen = entry.timestamp
    return sorted(groups.values(), key=lambda g: g.count, reverse=True)
