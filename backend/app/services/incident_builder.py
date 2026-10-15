"""Incident builder: turns anomalies into incidents.

Steps:
1. Merge anomalies that overlap or are close together (same problem, one incident).
2. Category from keywords in the incident's messages.
3. Severity from simple, explainable rules.
4. Candidate trigger: the earliest entry in the incident.

service_timeline() is also here; it works on parsed entries and on database rows alike.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable, Protocol

from app.services.parser import ERROR_LEVELS, ParsedEntry

MERGE_GAP_SECONDS = 300  # anomalies less than 5 minutes apart become one incident
MERGE_GAP_LINES = 50     # same idea for logs without timestamps
MAX_INCIDENTS = 50       # keep the most severe ones if a file produces more

# Checked in this order; the category with the most keyword hits wins.
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "database": ["database", "sql", "jdbc", "postgres", "mysql", "deadlock", "connection pool", "query", " db ",
                 "hikari", "connection from pool", "pool exhausted"],
    "memory": ["outofmemory", "out of memory", "heap", "oom", "memory", "gc overhead"],
    "disk": ["disk", "no space", "i/o error", "ioexception", "filesystem", "quota", "read-only file system"],
    "network": ["timeout", "timed out", "connection refused", "unreachable", "socket", "dns",
                "reset by peer", "502", "503", "504", "network", "connection reset",
                "no route to host", "noroute", "contacting rm"],
    "auth": ["auth", "unauthorized", "forbidden", "denied", "token", "login", "password",
             "certificate", "ssl", "invalid user", "break-in"],
    "config": ["config", "configuration", "missing property", "not configured", "classnotfound",
               "no such file", "invalid setting", "properties"],
    "hardware": ["hardware", "parity", "ecc", "temperature", "fan", "power supply", "kernel panic", "machine check"],
}
DEFAULT_CATEGORY = "application"

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


class EntryLike(Protocol):
    level: str
    service: str | None
    timestamp: datetime | None
    line_number: int


@dataclass
class BuiltIncident:
    entry_indices: list[int]
    title: str
    category: str
    severity: str
    start_time: datetime | None
    end_time: datetime | None
    error_count: int
    services: list[str]
    candidate_trigger: str | None
    candidate_trigger_line: int | None
    templates: list[str] = field(default_factory=list)  # distinct templates, most frequent first
    reasons: list[str] = field(default_factory=list)


def _sort_key(entry: EntryLike) -> tuple:
    return (entry.timestamp or datetime.min, entry.line_number)


def _span(entries: list[ParsedEntry]) -> tuple:
    times = [e.timestamp for e in entries if e.timestamp]
    lines = [e.line_number for e in entries]
    return (min(times) if times else None, max(times) if times else None, min(lines), max(lines))


def _close_enough(a: tuple, b: tuple) -> bool:
    """a and b are spans; b starts at or after a starts."""
    a_start, a_end, a_first, a_last = a
    b_start, _b_end, b_first, _b_last = b
    if a_end and b_start:
        return (b_start - a_end).total_seconds() <= MERGE_GAP_SECONDS
    return b_first - a_last <= MERGE_GAP_LINES


def merge_anomalies(entries: list[ParsedEntry], anomalies: list[dict]) -> list[tuple[set[int], list[str]]]:
    """Return merged groups as (entry index set, reasons)."""
    prepared = []
    for anomaly in anomalies:
        indices = {i for i in anomaly.get("entry_indices", []) if 0 <= i < len(entries)}
        if indices:
            members = [entries[i] for i in indices]
            prepared.append((_span(members), indices, anomaly.get("reason") or "anomaly"))
    prepared.sort(key=lambda item: (item[0][0] or datetime.min, item[0][2]))

    merged: list[list] = []  # [span, indices, reasons]
    for span, indices, reason in prepared:
        if merged and _close_enough(merged[-1][0], span):
            current = merged[-1]
            current[1] |= indices
            current[0] = _span([entries[i] for i in current[1]])
            if reason not in current[2]:
                current[2].append(reason)
        else:
            merged.append([span, set(indices), [reason]])
    return [(indices, reasons) for _span_, indices, reasons in merged]


def categorize(messages: Iterable[str]) -> str:
    text = " " + " ".join(messages).lower() + " "
    scores = {name: sum(text.count(word) for word in words) for name, words in CATEGORY_KEYWORDS.items()}
    best = max(scores, key=lambda name: scores[name])
    return best if scores[best] > 0 else DEFAULT_CATEGORY


def decide_severity(levels: list[str], error_count: int, service_count: int) -> str:
    """Rules, from most to least severe:
    critical: any FATAL entry, or 50+ errors
    high:     10+ errors, or 3+ services affected
    medium:   3+ errors
    low:      anything else
    """
    if "FATAL" in levels or error_count >= 50:
        return "critical"
    if error_count >= 10 or service_count >= 3:
        return "high"
    if error_count >= 3:
        return "medium"
    return "low"


# The earliest errors are usually closest to the cause; later ones are often knock-on effects
# (e.g. a gateway reporting 503s because the database is down). Category and title use them.
CAUSE_WINDOW = 5


def _title(category: str, first_error_template: str | None) -> str:
    text = first_error_template or "unknown error"
    text = text if len(text) <= 90 else text[:87] + "..."
    return f"{category.capitalize()} issue: {text}"


def build_incidents(entries: list[ParsedEntry], anomalies: list[dict]) -> list[BuiltIncident]:
    incidents = []
    for indices, reasons in merge_anomalies(entries, anomalies):
        members = sorted((entries[i] for i in indices), key=_sort_key)
        errors = [e for e in members if e.level in ERROR_LEVELS]
        services = sorted({e.service for e in members if e.service})
        # Most frequent templates, preferring error templates for the title.
        template_counts = Counter(e.template or e.message for e in (errors or members))
        all_templates = Counter(e.template or e.message for e in members)
        templates = [t for t, _ in template_counts.most_common()] + [
            t for t, _ in all_templates.most_common() if t not in template_counts
        ]
        trigger = members[0]
        # Earliest errors plus the trigger, with stack traces (raw), decide the category.
        cause_entries = [trigger] + (errors or members)[:CAUSE_WINDOW]
        category = categorize(e.raw for e in cause_entries)
        start, end, _first, _last = _span(members)
        first_error = (errors or members)[0]
        incidents.append(BuiltIncident(
            entry_indices=[e.index for e in members],
            title=_title(category, first_error.template or first_error.message),
            category=category,
            severity=decide_severity([e.level for e in members], len(errors), len(services)),
            start_time=start,
            end_time=end,
            error_count=len(errors),
            services=services,
            candidate_trigger=trigger.raw.splitlines()[0][:1000],
            candidate_trigger_line=trigger.line_number,
            templates=templates,
            reasons=reasons,
        ))
    incidents.sort(key=rank_key)
    return incidents[:MAX_INCIDENTS]


def rank_key(incident) -> tuple:
    """Most severe first, then most errors. Works for BuiltIncident and the Incident model."""
    return (SEVERITY_ORDER.get(incident.severity, 9), -incident.error_count)


def service_timeline(entries: Iterable[EntryLike]) -> list[dict]:
    """[{service, first_error, error_count}] for every service in the incident.
    Sorted by first error, so it reads as "which service broke first".
    Services that only logged warnings get first_error None and error_count 0, and come last."""
    stats: dict[str, dict] = {}
    for entry in entries:
        name = entry.service or "unknown"
        item = stats.setdefault(name, {"service": name, "first_error": None, "error_count": 0})
        if entry.level in ERROR_LEVELS:
            item["error_count"] += 1
            if entry.timestamp and (item["first_error"] is None or entry.timestamp < item["first_error"]):
                item["first_error"] = entry.timestamp
    return sorted(
        stats.values(),
        key=lambda r: (r["first_error"] is None, r["first_error"] or datetime.min, -r["error_count"], r["service"]),
    )
