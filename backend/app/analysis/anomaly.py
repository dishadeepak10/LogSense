"""Anomaly detection: three simple detectors written as pure Python functions.

"Pure" means: they only look at their inputs and return a result. No database,
no files, no network. That makes them easy to test and easy to explain.

    1. detect_spikes            a minute with far more errors than a normal minute (median + MAD)
    2. detect_bursts            many errors arriving one right after another
    3. detect_first_time_errors a new kind of error that never happened during normal operation

detect_anomalies() runs all three and is the function the backend calls.
Each anomaly is {"entry_indices": [...], "reason": "..."}; the backend's incident
builder later merges anomalies that overlap or are close together.

Each entry is a dict:
    {"index", "line_number", "timestamp" (datetime or None), "level", "service", "message", "template"}
"""
from __future__ import annotations

import math

from app.analysis import config

ERROR_LEVELS = ("ERROR", "FATAL")


def is_error(entry: dict) -> bool:
    return entry["level"] in ERROR_LEVELS


def median(values: list[float]) -> float:
    """The middle value after sorting (average of the two middle ones for an even count)."""
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def spike_threshold(counts: list[int]) -> tuple[float, float, float]:
    """Return (threshold, median, MAD) for a list of per-bucket error counts.

    MAD = median absolute deviation = the median of |count - median|.
    Why not mean + 3 x standard deviation? One huge spike pulls the mean up and
    inflates the standard deviation, so the threshold rises and the spike can hide
    itself. The median and MAD barely move when a few buckets are extreme.
    """
    middle = median(counts)
    mad = median([abs(count - middle) for count in counts])
    spread = max(mad * config.MAD_SCALE, config.MIN_MAD)
    return middle + config.SPIKE_K * spread, middle, mad


# ---------- Detector 1: error spike ----------

def _bucket_errors(entries: list[dict]) -> tuple[list[list[dict]], str]:
    """Put every error into a bucket. Returns (buckets, description of one bucket).
    Uses time when the log has timestamps, otherwise line numbers."""
    timed = [e for e in entries if e["timestamp"] is not None]
    if timed:
        start = min(e["timestamp"] for e in timed)
        end = max(e["timestamp"] for e in timed)
        span = (end - start).total_seconds()
        size = max(config.SPIKE_BUCKET_SECONDS, math.ceil(span / config.SPIKE_MAX_BUCKETS))
        buckets = [[] for _ in range(int(span // size) + 1)]
        for entry in timed:
            if is_error(entry):
                slot = int((entry["timestamp"] - start).total_seconds() // size)
                buckets[slot].append(entry)
        return buckets, f"{size} s"

    if not entries:
        return [], ""
    first_line = min(e["line_number"] for e in entries)
    last_line = max(e["line_number"] for e in entries)
    size = config.SPIKE_LINES_PER_BUCKET
    buckets = [[] for _ in range((last_line - first_line) // size + 1)]
    for entry in entries:
        if is_error(entry):
            buckets[(entry["line_number"] - first_line) // size].append(entry)
    return buckets, f"{size} lines"


def detect_spikes(entries: list[dict]) -> list[dict]:
    buckets, bucket_size = _bucket_errors(entries)
    if not buckets:
        return []
    counts = [len(bucket) for bucket in buckets]
    threshold, normal, _mad = spike_threshold(counts)

    anomalies = []
    current: list[dict] = []  # neighbouring spike buckets are joined into one anomaly
    for bucket in buckets + [[]]:  # the extra empty bucket closes the last run
        if len(bucket) >= config.SPIKE_MIN_ERRORS and len(bucket) > threshold:
            current.extend(bucket)
            continue
        if current:
            anomalies.append({
                "entry_indices": [e["index"] for e in current],
                "reason": (f"error spike: {len(current)} errors where a normal {bucket_size} has "
                           f"about {normal:g} (threshold {threshold:.1f})"),
            })
            current = []
    return anomalies


# ---------- Detector 2: burst ----------

def _close_together(earlier: dict, later: dict) -> bool:
    if earlier["timestamp"] and later["timestamp"]:
        return (later["timestamp"] - earlier["timestamp"]).total_seconds() <= config.BURST_GAP_SECONDS
    return later["line_number"] - earlier["line_number"] <= config.BURST_GAP_LINES


def detect_bursts(entries: list[dict]) -> list[dict]:
    """Walk through the errors in file order. An error close to the previous one joins
    its burst; otherwise a new burst starts. Big enough bursts (or any FATAL) are anomalies."""
    bursts: list[list[dict]] = []
    for entry in entries:
        if not is_error(entry):
            continue
        if bursts and _close_together(bursts[-1][-1], entry):
            bursts[-1].append(entry)
        else:
            bursts.append([entry])

    anomalies = []
    for burst in bursts:
        has_fatal = any(e["level"] == "FATAL" for e in burst)
        if len(burst) >= config.BURST_MIN_ERRORS or has_fatal:
            reason = f"burst of {len(burst)} errors close together"
            if has_fatal:
                reason += " (includes FATAL)"
            anomalies.append({"entry_indices": [e["index"] for e in burst], "reason": reason})
    return anomalies


# ---------- Detector 3: first-time error ----------

def _position(entry: dict, entries: list[dict], start, end) -> float:
    """Where the entry sits in the log, from 0.0 (start) to 1.0 (end)."""
    if start is not None and end is not None and end > start and entry["timestamp"] is not None:
        return (entry["timestamp"] - start).total_seconds() / (end - start).total_seconds()
    return entry["index"] / max(len(entries) - 1, 1)


def detect_first_time_errors(entries: list[dict]) -> list[dict]:
    """An error template that first appears AFTER the baseline period (the first 20%
    of the log, when things were running normally) and repeats is a new problem.
    It catches slow, steady new errors that are not bursty enough for the other two."""
    times = [e["timestamp"] for e in entries if e["timestamp"] is not None]
    start, end = (min(times), max(times)) if times else (None, None)

    by_template: dict[str, list[dict]] = {}  # dicts keep insertion order = order of first appearance
    for entry in entries:
        if is_error(entry):
            by_template.setdefault(entry["template"] or entry["message"], []).append(entry)

    anomalies = []
    for template, occurrences in by_template.items():
        first = occurrences[0]
        if len(occurrences) < config.FIRST_TIME_MIN_COUNT:
            continue
        if _position(first, entries, start, end) <= config.FIRST_TIME_BASELINE_FRACTION:
            continue
        short = template if len(template) <= 80 else template[:77] + "..."
        anomalies.append({
            "entry_indices": [e["index"] for e in occurrences[:config.FIRST_TIME_MAX_LINES]],
            "reason": f"first-time error after normal operation ({len(occurrences)}x): {short}",
        })
    return anomalies


# ---------- Putting it together ----------

def add_leadup_warnings(anomaly: dict, entries: list[dict], position_of: dict[int, int]) -> dict:
    """Add WARN lines from the same services shortly before the anomaly's first error."""
    members = [entries[position_of[i]] for i in anomaly["entry_indices"]]
    first = min(members, key=lambda e: position_of[e["index"]])
    services = {e["service"] for e in members}
    start = position_of[first["index"]]
    extra = []
    for earlier in entries[max(0, start - config.LEADUP_LOOKBACK_LINES):start]:
        if earlier["level"] != "WARN" or earlier["service"] not in services:
            continue
        if earlier["timestamp"] and first["timestamp"]:
            gap = (first["timestamp"] - earlier["timestamp"]).total_seconds()
            if gap > config.LEADUP_WARN_SECONDS:
                continue
        extra.append(earlier["index"])
    return {"entry_indices": sorted(set(anomaly["entry_indices"]) | set(extra)), "reason": anomaly["reason"]}


def detect_anomalies(entries: list[dict], groups: list[dict]) -> list[dict]:
    """Called by the backend. Runs all three detectors.

    groups (template groups) is part of the signature agreed with the backend;
    the detectors only need the entries, so it is not used yet.
    """
    position_of = {entry["index"]: position for position, entry in enumerate(entries)}
    found = detect_spikes(entries) + detect_bursts(entries) + detect_first_time_errors(entries)
    return [add_leadup_warnings(anomaly, entries, position_of) for anomaly in found]
