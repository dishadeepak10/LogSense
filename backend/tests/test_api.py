from conftest import APP_LOG, FIXTURES

from app.routers import logs as logs_router
from app.services import analysis_adapter


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_upload_runs_full_pipeline(upload):
    response = upload(APP_LOG)
    assert response.status_code == 201
    body = response.json()

    file = body["file"]
    assert (file["total_lines"], file["parsed_lines"], file["unparsed_lines"]) == (14, 13, 1)
    assert file["uploaded_at"].endswith("Z")

    summary = body["summary"]
    assert summary["level_counts"]["ERROR"] == 5
    assert summary["top_error_groups"][0]["count"] == 1
    assert sum(b["errors"] for b in summary["error_timeline"]) == 5

    # One database incident; the lone auth error an hour later is not an incident.
    assert len(body["incidents"]) == 1
    incident = body["incidents"][0]
    assert incident["category"] == "database"
    assert incident["error_count"] == 4
    assert incident["candidate_trigger_line"] == 3
    assert [s["service"] for s in incident["service_timeline"]] == ["payment-service", "order-service", "api-gateway"]
    assert incident["analysis"]["confidence"] in ("high", "low")
    assert incident["similar_incidents"] == []


def test_rejected_uploads(upload, client, monkeypatch):
    assert upload("hello", "a.exe").status_code == 415
    assert upload("   \n", "a.log").status_code == 400
    assert upload(b"PK\x03\x04\x00\x00", "a.log").status_code == 415
    monkeypatch.setattr(logs_router, "MAX_UPLOAD_BYTES", 10)
    assert upload("x" * 11, "a.log").status_code == 413
    assert client.post("/api/logs/upload").status_code == 422


def test_file_endpoints(upload, client):
    file_id = upload(APP_LOG)
    file_id = file_id.json()["file"]["id"]
    assert any(f["id"] == file_id for f in client.get("/api/logs").json())
    assert client.get(f"/api/logs/{file_id}").json()["file"]["id"] == file_id
    assert client.get(f"/api/logs/{file_id}/summary").json()["entry_count"] == 9
    incidents = client.get(f"/api/logs/{file_id}/incidents").json()
    detail = client.get(f"/api/incidents/{incidents[0]['id']}").json()
    assert detail["total_entries"] == len(detail["entries"]) == 5
    assert "Caused by" in detail["entries"][1]["raw"]

    report = client.get(f"/api/logs/{file_id}/report")
    assert report.headers["content-type"].startswith("text/markdown")
    assert "attachment" in report.headers["content-disposition"]
    assert "## Incidents" in report.text and "Probable root cause" in report.text


def test_missing_ids_return_404(client):
    for url in ["/api/logs/999999", "/api/logs/999999/summary", "/api/logs/999999/incidents",
                "/api/logs/999999/report", "/api/incidents/999999"]:
        assert client.get(url).status_code == 404, url


def test_samples(client):
    size = (FIXTURES / "samples" / "small_app.log").stat().st_size
    assert client.get("/api/samples").json() == [{"name": "small_app.log", "size_bytes": size}]  # notes.md hidden
    response = client.post("/api/samples/small_app.log/load")
    assert response.status_code == 201
    assert response.json()["file"]["source"] == "sample"
    assert len(response.json()["incidents"]) == 1


def test_samples_reject_unknown_and_unlisted_names(client):
    for name in ["notes.md", "nope.log", "..%2Fconftest.py", "..%2F..%2Frequirements.txt"]:
        assert client.post(f"/api/samples/{name}/load").status_code == 404, name


def test_similarity_skips_identical_files(upload, monkeypatch):
    seen = []

    def fake_find(name):
        if name == "find_similar_incidents":
            def find(templates, past):
                seen.append({p["file_name"] for p in past})
                return [{"incident_id": p["incident_id"], "file_name": p["file_name"], "similarity": 0.5} for p in past]
            return find
        return None

    other_log = APP_LOG.replace("payment-service", "billing-service")
    upload(other_log, "other.log")
    monkeypatch.setattr(analysis_adapter, "_find", fake_find)
    response = upload(APP_LOG, "again.log")  # identical content to earlier uploads

    # Earlier identical uploads (app.log) are excluded. Other tests may have added other files.
    assert seen and "other.log" in seen[-1] and not seen[-1] & {"app.log", "again.log"}
    similar = response.json()["incidents"][0]["similar_incidents"]
    assert similar and "other.log" in {s["file_name"] for s in similar}
    assert not {s["file_name"] for s in similar} & {"app.log", "again.log"}


def test_file_with_no_recognizable_lines_is_still_accepted(upload):
    body = upload("just some notes\nnothing that looks like a log\n", "notes.txt").json()
    assert body["file"]["unparsed_lines"] == 2 and body["file"]["parsed_lines"] == 0
    assert body["incidents"] == [] and body["summary"]["error_timeline"] == []
