"""The ONLY place backend code calls into Disha's app/analysis package.

Backend never edits app/analysis/. This file looks up her four functions by name
in any module of that package and calls them with the inputs described below.
If a function doesn't exist yet, raises an error, or returns something malformed,
we log it and use a simple placeholder so uploads keep working end to end.

Interface we call (agree these with Disha; change only this file if hers differ):

    detect_anomalies(entries, groups) -> [{"entry_indices": [int, ...], "reason": str}, ...]
        entries: [{"index", "line_number", "timestamp" (datetime|None), "level", "service",
                   "message", "template"}]
        groups:  [{"template", "level", "count", "first_seen", "last_seen", "services",
                   "example", "entry_indices"}]

    analyze_incident(incident, use_llm) -> {"root_cause": str, "why": str,
                                            "suggested_action": str, "source": "llm"|"fallback"}
        incident: see pipeline.incident_context(); use_llm is False for incidents
        beyond the top MAX_LLM_INCIDENTS, which should get her non-LLM fallback.

    find_similar_incidents(templates, past_incidents) -> [{"incident_id", "file_name", "similarity"}]
        templates: this incident's distinct templates
        past_incidents: [{"incident_id", "file_name", "templates": [str, ...]}] from earlier
        files (identical files already excluded)

    decide_confidence(incident, analysis) -> "high" | "low"
"""
from __future__ import annotations

import importlib
import logging
from datetime import datetime
from typing import Callable

from app.services.parser import ERROR_LEVELS

logger = logging.getLogger(__name__)

_ANALYSIS_MODULES = ["", "anomaly", "similarity", "confidence", "llm_client", "fallback", "evidence", "prompt"]


def _find(function_name: str) -> Callable | None:
    for module_name in _ANALYSIS_MODULES:
        full_name = "app.analysis" + (f".{module_name}" if module_name else "")
        try:
            module = importlib.import_module(full_name)
        except Exception:
            logger.exception("Could not import %s", full_name)
            continue
        function = getattr(module, function_name, None)
        if callable(function):
            return function
    return None


def _call(function_name: str, *args):
    """Call Disha's function. Returns (found, result); result is None if it failed."""
    function = _find(function_name)
    if function is None:
        return False, None
    try:
        return True, function(*args)
    except Exception:
        logger.exception("analysis.%s failed; using placeholder", function_name)
        return True, None


# ---------- detect_anomalies ----------

CLUSTER_GAP_SECONDS = 60
CLUSTER_GAP_LINES = 20
MIN_ERRORS_PER_ANOMALY = 2
WARN_LOOKBACK_SECONDS = 60


def _close(a: dict, b: dict) -> bool:
    if a["timestamp"] and b["timestamp"]:
        return abs((b["timestamp"] - a["timestamp"]).total_seconds()) <= CLUSTER_GAP_SECONDS
    return abs(b["line_number"] - a["line_number"]) <= CLUSTER_GAP_LINES


def _placeholder_detect_anomalies(entries: list[dict], groups: list[dict]) -> list[dict]:
    """PLACEHOLDER until Disha's detect_anomalies exists: bursts of errors close in time.
    A burst needs 2+ errors (or one FATAL). Warnings from the same services shortly
    before the burst are included, since they are often the trigger."""
    clusters: list[list[dict]] = []
    for entry in entries:
        if entry["level"] not in ERROR_LEVELS:
            continue
        if clusters and _close(clusters[-1][-1], entry):
            clusters[-1].append(entry)
        else:
            clusters.append([entry])

    anomalies = []
    for cluster in clusters:
        if len(cluster) < MIN_ERRORS_PER_ANOMALY and not any(e["level"] == "FATAL" for e in cluster):
            continue
        services = {e["service"] for e in cluster}
        first = cluster[0]
        indices = [e["index"] for e in cluster]
        for earlier in reversed(entries[max(0, first["index"] - 50):first["index"]]):
            if earlier["level"] != "WARN" or earlier["service"] not in services:
                continue
            if earlier["timestamp"] and first["timestamp"]:
                if (first["timestamp"] - earlier["timestamp"]).total_seconds() > WARN_LOOKBACK_SECONDS:
                    break
            indices.append(earlier["index"])
        anomalies.append({"entry_indices": sorted(indices), "reason": f"burst of {len(cluster)} errors"})
    return anomalies


def detect_anomalies(entries: list[dict], groups: list[dict]) -> list[dict]:
    found, result = _call("detect_anomalies", entries, groups)
    if isinstance(result, list):
        valid = [
            {"entry_indices": [int(i) for i in a["entry_indices"]], "reason": str(a.get("reason") or "anomaly")}
            for a in result
            if isinstance(a, dict) and isinstance(a.get("entry_indices"), (list, tuple, set))
        ]
        if len(valid) == len(result):
            return valid
        logger.warning("detect_anomalies returned malformed items; using placeholder")
    elif found and result is not None:
        logger.warning("detect_anomalies returned %s, expected a list; using placeholder", type(result).__name__)
    return _placeholder_detect_anomalies(entries, groups)


# ---------- analyze_incident ----------

_HINTS = {
    "database": ("The database was unreachable, overloaded, or rejecting queries.",
                 "Check database health and connections, the connection pool size, and slow or locked queries."),
    "memory": ("The process ran out of memory.",
               "Check memory usage and limits, look for leaks or very large requests, and raise the heap or container limit if needed."),
    "disk": ("A disk or file system problem: full disk, I/O errors, or a read-only volume.",
             "Free disk space, check the volume's health and mount state, and review log rotation."),
    "network": ("A network problem between services: timeouts, refused or reset connections.",
                "Check that the target service is up, plus DNS, firewall rules, and timeout settings."),
    "auth": ("Authentication or authorization failures.",
             "Check credentials, tokens, and certificates for expiry, and look for unexpected login attempts."),
    "config": ("A configuration problem: a missing or invalid setting, file, or class.",
               "Compare the configuration with the last working deployment and check that required files exist."),
    "hardware": ("A hardware fault reported by the system.",
                 "Check the hardware event logs for the affected node and consider moving work off it."),
    "application": ("An application error, such as an unhandled exception or a failed operation.",
                    "Read the stack trace of the first error, find the code path involved, and check recent changes."),
}


def _fmt(value) -> str:
    return value.isoformat(sep=" ") if isinstance(value, datetime) else str(value or "unknown time")


def _placeholder_analysis(incident: dict) -> dict:
    """PLACEHOLDER until Disha's analyze_incident exists: a rule-based explanation by category."""
    cause, action = _HINTS.get(incident["category"], _HINTS["application"])
    top = incident["templates"][0]["template"] if incident["templates"] else "n/a"
    services = ", ".join(incident["services"]) or "an unknown service"
    return {
        "root_cause": f"{cause} The most frequent error was: \"{top}\".",
        "why": (f"{incident['error_count']} errors from {services} between {_fmt(incident['start_time'])} "
                f"and {_fmt(incident['end_time'])}. The earliest related line was: {incident['candidate_trigger']}"),
        "suggested_action": action,
        "source": "fallback",
    }


def analyze_incident(incident: dict, use_llm: bool) -> dict:
    _found, result = _call("analyze_incident", incident, use_llm)
    keys = ("root_cause", "why", "suggested_action")
    if isinstance(result, dict) and all(isinstance(result.get(k), str) and result[k].strip() for k in keys):
        source = result.get("source")
        return {
            **{k: result[k].strip() for k in keys},
            "source": source if source in ("llm", "fallback") else ("llm" if use_llm else "fallback"),
        }
    if result is not None:
        logger.warning("analyze_incident returned a malformed result; using placeholder")
    return _placeholder_analysis(incident)


# ---------- find_similar_incidents ----------

def find_similar_incidents(templates: list[str], past_incidents: list[dict]) -> list[dict]:
    """Backend does not do matching itself: without Disha's function the list stays empty."""
    if not past_incidents:
        return []
    _found, result = _call("find_similar_incidents", templates, past_incidents)
    if not isinstance(result, list):
        return []
    clean = []
    for item in result:
        try:
            clean.append({
                "incident_id": int(item["incident_id"]),
                "file_name": str(item["file_name"]),
                "similarity": round(min(max(float(item["similarity"]), 0.0), 1.0), 2),
            })
        except (KeyError, TypeError, ValueError):
            logger.warning("Skipping malformed similar incident: %r", item)
    return sorted(clean, key=lambda s: s["similarity"], reverse=True)


# ---------- decide_confidence ----------

def decide_confidence(incident: dict, analysis: dict) -> str:
    """Defaults to "low" when Disha's function is missing or returns something unexpected."""
    _found, result = _call("decide_confidence", incident, analysis)
    return result if result in ("high", "low") else "low"
