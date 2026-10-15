"""Test setup: a throwaway SQLite database and a test samples folder.

Environment variables are set BEFORE the app is imported, because app/config.py
reads them once at import time.
"""
import os
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).resolve().parent / "fixtures"

_tmp = tempfile.mkdtemp(prefix="logsense-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["SAMPLE_LOGS_DIR"] = str(FIXTURES / "samples")
os.environ["LLM_API_KEY"] = ""  # tests must never call a real LLM, even if .env has a key
sys.path.insert(0, str(BACKEND_DIR))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

# A small app log with one database incident and one lone error that should NOT become an incident.
APP_LOG = """\
2026-10-01 09:00:00,001 INFO  [api-gateway] Service started on port 8080
2026-10-01 09:00:05,002 INFO  [payment-service] Payment 1001 authorized
2026-10-01 09:01:00,000 WARN  [payment-service] Slow query took 4200 ms: SELECT * FROM payments
2026-10-01 09:01:10,000 ERROR [payment-service] Could not get JDBC connection: pool exhausted after 30000 ms
java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available
\tat com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:197)
Caused by: org.postgresql.util.PSQLException: remaining connection slots are reserved
\t... 12 more
2026-10-01 09:01:15,000 ERROR [order-service] Failed to save order 5001: database connection timed out
2026-10-01 09:01:20,000 ERROR [payment-service] Timeout waiting for connection from pool after 30000 ms
2026-10-01 09:01:30,000 ERROR [api-gateway] Upstream payment-service returned 503 for POST /api/payments
=== log rotated ===
2026-10-01 09:30:00,000 INFO  [payment-service] Payment 1002 authorized
2026-10-01 09:45:00,000 ERROR [auth-service] Invalid token for user 4512
"""


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:  # "with" runs the startup code that creates tables
        yield test_client


@pytest.fixture
def upload(client):
    def _upload(content: str | bytes, name: str = "app.log"):
        data = content.encode() if isinstance(content, str) else content
        return client.post("/api/logs/upload", files={"file": (name, data, "text/plain")})
    return _upload
