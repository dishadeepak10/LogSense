"""Rule-based fallback: an answer in the same three fields, without any LLM.

Used when there is no API key, the LLM fails or times out, its answer is not
valid JSON, or the incident is not in the top few that get an LLM call.
The whole app keeps working with the API key removed.
"""
from __future__ import annotations

from datetime import datetime

# category -> (root_cause, suggested_action). "why" is built from the incident's own facts.
FALLBACK_TABLE: dict[str, tuple[str, str]] = {
    "database": (
        "The database was unreachable, overloaded, or ran out of connections.",
        "1) Check that the database is up and accepting connections. 2) Compare active connections "
        "with the connection pool size and look for leaked connections. 3) Look for slow or locked queries.",
    ),
    "memory": (
        "The process ran out of memory.",
        "1) Check memory usage and limits for the affected service. 2) Look for a memory leak or a very "
        "large request around the start time. 3) Raise the heap or container memory limit if usage is normal.",
    ),
    "disk": (
        "A disk or file system problem: the disk is full, has I/O errors, or is read-only.",
        "1) Check free disk space on the affected host. 2) Check the volume's health and mount state. "
        "3) Review log rotation and clean up large files.",
    ),
    "network": (
        "A network problem between services: timeouts, refused connections, or an unavailable upstream.",
        "1) Check that the target service is running and healthy. 2) Check DNS, firewall rules and ports. "
        "3) Review timeout and retry settings.",
    ),
    "auth": (
        "Authentication or authorization failures: invalid credentials, expired tokens or certificates.",
        "1) Check whether credentials, tokens or certificates expired or were rotated. 2) Check for a burst "
        "of failed logins from one source. 3) Verify the auth service and its configuration.",
    ),
    "config": (
        "A configuration problem: a missing or invalid setting, file, or class.",
        "1) Compare the configuration with the last working deployment. 2) Check that required files, "
        "environment variables and dependencies exist. 3) Roll back the latest config change if needed.",
    ),
    "hardware": (
        "A hardware fault reported by the system.",
        "1) Check the hardware event logs for the affected node. 2) Move work off the node. "
        "3) Contact the infrastructure team about replacing the part.",
    ),
    "application": (
        "An application error, such as an unhandled exception or a failed operation.",
        "1) Read the stack trace of the first error. 2) Find the code path involved. "
        "3) Check what changed recently (deployments, inputs, dependencies).",
    ),
}


def _time(value) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S") if isinstance(value, datetime) else "an unknown time"


def build_fallback(incident: dict) -> dict:
    """Fill the three fields from the table, using the incident's own facts for "why"."""
    category = incident.get("category") if incident.get("category") in FALLBACK_TABLE else "application"
    root_cause, action = FALLBACK_TABLE[category]
    templates = incident.get("templates") or []
    top = templates[0]["template"] if templates else "unknown"
    services = ", ".join(incident.get("services") or []) or "an unknown service"
    why = (
        f"Rule-based guess from keywords (category: {category}). "
        f"{incident.get('error_count', 0)} errors from {services} between {_time(incident.get('start_time'))} "
        f"and {_time(incident.get('end_time'))}. Most frequent error: \"{top}\". "
        f"Earliest related line: {incident.get('candidate_trigger') or 'unknown'}"
    )
    return {"root_cause": root_cause, "why": why, "suggested_action": action, "source": "fallback"}
