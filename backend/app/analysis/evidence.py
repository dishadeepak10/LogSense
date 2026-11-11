"""Evidence bundle: the small, safe piece of the log we show to the LLM.

Why not send the whole log? It is too big (cost and limits), it may contain
secrets, and the LLM answers better with a focused summary.

The bundle has:
  - a few facts (category, severity, time range, services, how the incident was detected)
  - the most frequent error templates with counts
  - the candidate trigger line
  - up to 40 representative raw lines (duplicates removed)
All of it is masked (IPs, emails, tokens, passwords) and capped in size, then
wrapped in clear START/END markers (see prompt.py for why).
"""
from __future__ import annotations

import re
from datetime import datetime

from app.analysis import config

# (pattern, replacement). Order matters: the most specific patterns go first.
_MASKS = [
    (re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b"), "<EMAIL>"),
    (re.compile(r"\beyJ[\w-]+\.[\w-]+\.[\w-]+"), "<JWT>"),
    (re.compile(r"(?i)\b(bearer|basic)\s+[\w.~+/=-]{8,}"), r"\1 <TOKEN>"),
    (re.compile(r"(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|auth)(\s*[=:]\s*)[^\s,;&\"']+"),
     r"\1\2<SECRET>"),
    (re.compile(r"\b(?:sk|pk|rk|ghp|gho|xox[abp])[-_][\w-]{10,}\b"), "<TOKEN>"),
    (re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b"), "<IP>"),
    (re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){4,7}[0-9a-fA-F]{1,4}\b"), "<IP>"),  # IPv6
]


def mask_sensitive(text: str) -> str:
    """Replace personal or secret values with placeholders like <IP> and <EMAIL>."""
    for pattern, replacement in _MASKS:
        text = pattern.sub(replacement, text)
    return text


def remove_markers(text: str) -> str:
    """A log line must never be able to 'close' the evidence block early, so we
    remove our own marker strings if somebody wrote them into the log."""
    return text.replace(config.EVIDENCE_START, "[marker removed]").replace(config.EVIDENCE_END, "[marker removed]")


def clean_line(text: str) -> str:
    text = remove_markers(mask_sensitive(text.replace("\r", "")))
    if len(text) > config.EVIDENCE_MAX_LINE_CHARS:
        text = text[:config.EVIDENCE_MAX_LINE_CHARS] + " ...[cut]"
    return text


_DIGITS = re.compile(r"\d+")


def representative_lines(raw_lines: list[str]) -> list[str]:
    """Pick up to EVIDENCE_MAX_LINES lines, skipping lines that only differ in numbers
    (so 30 copies of "Timeout after 3000 ms" become one line)."""
    seen, picked = set(), []
    for raw in raw_lines:
        # Stack traces can be long; keep the first 4 lines of each record (message + top frames).
        record = "\n".join(raw.splitlines()[:4])
        shape = _DIGITS.sub("#", record.splitlines()[0] if record else "")
        if shape in seen:
            continue
        seen.add(shape)
        picked.append(record)
        if len(picked) >= config.EVIDENCE_MAX_LINES:
            break
    return picked


def _time(value) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S") if isinstance(value, datetime) else "unknown"


def build_evidence(incident: dict) -> str:
    """Build the masked, size-capped evidence text for one incident (without the markers)."""
    parts = [
        "FACTS",
        f"- Rule-based category: {incident.get('category', 'unknown')}",
        f"- Severity: {incident.get('severity', 'unknown')}",
        f"- Time range: {_time(incident.get('start_time'))} to {_time(incident.get('end_time'))}",
        f"- Error count: {incident.get('error_count', 0)}",
        f"- Services involved: {', '.join(incident.get('services') or []) or 'unknown'}",
        f"- Detected because: {'; '.join(incident.get('reasons') or []) or 'unknown'}",
        "",
        "MOST FREQUENT MESSAGE TEMPLATES (count x template)",
    ]
    for item in (incident.get("templates") or [])[:10]:
        parts.append(f"- {item['count']} x {clean_line(item['template'])}")

    timeline = incident.get("service_timeline") or []
    if timeline:
        parts += ["", "SERVICES IN ORDER OF FIRST ERROR"]
        for row in timeline:
            parts.append(f"- {row['service']}: first error {_time(row['first_error'])}, {row['error_count']} errors")

    parts += [
        "",
        f"CANDIDATE TRIGGER (earliest related line, line {incident.get('candidate_trigger_line')})",
        clean_line(incident.get("candidate_trigger") or "unknown"),
        "",
        "REPRESENTATIVE LOG LINES (in time order)",
    ]
    header = "\n".join(parts)

    # Add lines one by one until the size cap is reached.
    text = header
    for line in representative_lines(incident.get("sample_lines") or []):
        line = "\n".join(clean_line(part) for part in line.splitlines())
        if len(text) + len(line) + 1 > config.EVIDENCE_MAX_CHARS:
            text += "\n...[more lines cut to keep the evidence small]"
            break
        text += "\n" + line
    return text[:config.EVIDENCE_MAX_CHARS]
