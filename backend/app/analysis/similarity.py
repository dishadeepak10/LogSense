"""Seen before: find earlier incidents that look like the new one.

Each incident is described by its SET of error templates (messages with numbers,
IPs and IDs masked). Two incidents are compared with Jaccard similarity:

    similarity = (templates in both) / (templates in either)

Example: {A, B, C} and {B, C, D} share 2 of 4 unique templates -> 0.5.
1.0 means identical sets, 0.0 means nothing in common.
"""
from __future__ import annotations

from app.analysis import config


def jaccard(first: set, second: set) -> float:
    if not first and not second:
        return 0.0
    return len(first & second) / len(first | second)


def find_similar_incidents(new_templates: list[str], past_incidents: list[dict]) -> list[dict]:
    """past_incidents: [{"incident_id", "file_name", "templates": [...]}, ...]
    Returns [{"incident_id", "file_name", "similarity"}] above the threshold, best first."""
    new_set = set(new_templates)
    matches = []
    for past in past_incidents:
        score = jaccard(new_set, set(past["templates"]))
        if score >= config.SIMILARITY_THRESHOLD:
            matches.append({
                "incident_id": past["incident_id"],
                "file_name": past["file_name"],
                "similarity": round(score, 2),
            })
    matches.sort(key=lambda match: match["similarity"], reverse=True)
    return matches[:config.SIMILARITY_MAX_RESULTS]
