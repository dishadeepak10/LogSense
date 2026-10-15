"""The adapter must keep uploads working whatever Disha's functions do."""
from datetime import datetime

import pytest

from app.services import analysis_adapter

INCIDENT = {
    "category": "database", "templates": [{"template": "pool exhausted", "count": 3}], "services": ["pay"],
    "error_count": 3, "start_time": datetime(2026, 10, 1, 9), "end_time": datetime(2026, 10, 1, 9, 5),
    "candidate_trigger": "WARN pool at 92%",
}


@pytest.fixture
def disha(monkeypatch):
    """Pretend Disha's package defines the given functions."""
    def install(**functions):
        monkeypatch.setattr(analysis_adapter, "_find", lambda name: functions.get(name))
    return install


def test_placeholders_when_functions_are_missing(disha):
    disha()
    analysis = analysis_adapter.analyze_incident(INCIDENT, True)
    assert analysis["source"] == "fallback" and "database" in analysis["root_cause"]
    assert analysis_adapter.decide_confidence(INCIDENT, analysis) == "low"
    assert analysis_adapter.find_similar_incidents(["t"], [{"incident_id": 1, "file_name": "a", "templates": ["t"]}]) == []


def test_real_functions_are_used(disha):
    disha(
        analyze_incident=lambda incident, use_llm: {"root_cause": "rc", "why": "w", "suggested_action": "a"},
        decide_confidence=lambda root_cause, category: "high" if category == "database" else "low",
        find_similar_incidents=lambda templates, past: [{"incident_id": "7", "file_name": "old.log", "similarity": 1.7}],
    )
    assert analysis_adapter.analyze_incident(INCIDENT, True) == {
        "root_cause": "rc", "why": "w", "suggested_action": "a", "source": "llm"}
    assert analysis_adapter.decide_confidence(INCIDENT, {"root_cause": "rc", "source": "llm"}) == "high"
    assert analysis_adapter.decide_confidence(INCIDENT, {"root_cause": "rc", "source": "fallback"}) == "low"
    assert analysis_adapter.find_similar_incidents(["t"], [{"incident_id": 7}]) == [
        {"incident_id": 7, "file_name": "old.log", "similarity": 1.0}]  # cleaned and clamped


def test_crashing_or_malformed_functions_fall_back(disha):
    def crash(*args):
        raise RuntimeError("LLM down")
    disha(analyze_incident=crash, decide_confidence=lambda *a: "maybe",
          detect_anomalies=lambda entries, groups: "not a list")
    assert analysis_adapter.analyze_incident(INCIDENT, True)["source"] == "fallback"
    assert analysis_adapter.decide_confidence(INCIDENT, {"root_cause": "rc", "source": "llm"}) == "low"
    entries = [
        {"index": i, "line_number": i + 1, "timestamp": datetime(2026, 10, 1, 9, 0, i), "level": "ERROR",
         "service": "pay", "message": "x", "template": "x"}
        for i in range(3)
    ]
    assert analysis_adapter.detect_anomalies(entries, []) == [{"entry_indices": [0, 1, 2], "reason": "burst of 3 errors"}]


def test_placeholder_needs_two_errors_or_a_fatal(disha):
    disha()
    lone = [{"index": 0, "line_number": 1, "timestamp": None, "level": "ERROR", "service": "a", "message": "x", "template": "x"}]
    assert analysis_adapter.detect_anomalies(lone, []) == []
    lone[0]["level"] = "FATAL"
    assert len(analysis_adapter.detect_anomalies(lone, [])) == 1
