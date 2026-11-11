from app.services.grouping import add_templates
from app.services.incident_builder import build_incidents, categorize, decide_severity, service_timeline
from app.services.parser import parse_log


def _entries(text):
    entries = parse_log(text).entries
    add_templates(entries)
    return entries


LOG = (
    "2026-10-01 09:00:00 WARN [db] pool at 92%\n"         # 0
    "2026-10-01 09:00:10 ERROR [pay] jdbc pool exhausted\n"  # 1
    "2026-10-01 09:00:20 ERROR [gw] upstream returned 503\n"  # 2
    "2026-10-01 09:02:00 ERROR [pay] jdbc pool exhausted\n"  # 3
    "2026-10-01 10:00:00 ERROR [auth] token expired\n"       # 4
    "2026-10-01 10:00:05 ERROR [auth] token expired\n"       # 5
)


def test_close_anomalies_merge_and_far_ones_stay_separate():
    entries = _entries(LOG)
    anomalies = [
        {"entry_indices": [0, 1, 2], "reason": "burst"},
        {"entry_indices": [3], "reason": "spike"},     # 100 s later: same incident
        {"entry_indices": [4, 5], "reason": "burst"},  # an hour later: new incident
    ]
    incidents = build_incidents(entries, anomalies)
    assert sorted(len(i.entry_indices) for i in incidents) == [2, 4]
    db_incident = next(i for i in incidents if len(i.entry_indices) == 4)
    assert db_incident.reasons == ["burst", "spike"]
    assert db_incident.candidate_trigger_line == 1  # the warning that came first
    assert db_incident.category == "database"
    assert db_incident.title.startswith("Database issue: jdbc pool exhausted")
    assert db_incident.error_count == 3


def test_invalid_indices_are_ignored():
    assert build_incidents(_entries(LOG), [{"entry_indices": [99, -1]}]) == []


def test_severity_rules():
    assert decide_severity(["ERROR", "FATAL"], 1, 1) == "critical"
    assert decide_severity(["ERROR"] * 50, 50, 1) == "critical"
    assert decide_severity(["ERROR"] * 10, 10, 1) == "high"
    assert decide_severity(["ERROR"], 1, 3) == "high"
    assert decide_severity(["ERROR"] * 3, 3, 1) == "medium"
    assert decide_severity(["WARN", "ERROR"], 1, 1) == "low"


def test_categorize():
    assert categorize(["java.lang.OutOfMemoryError: Java heap space"]) == "memory"
    assert categorize(["Connection refused by 10.0.0.1"]) == "network"
    assert categorize(["something odd happened"]) == "application"


def test_service_timeline_orders_by_first_error():
    entries = _entries(LOG)[:4]
    timeline = service_timeline(entries)
    assert [row["service"] for row in timeline] == ["pay", "gw", "db"]
    assert timeline[0]["error_count"] == 2
    assert timeline[-1] == {"service": "db", "first_error": None, "error_count": 0}  # warnings only
