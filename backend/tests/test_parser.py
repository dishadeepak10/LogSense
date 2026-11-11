from pathlib import Path

import pytest

from app.services.parser import parse_log

LOGHUB = Path(__file__).parent / "fixtures" / "loghub"


@pytest.mark.parametrize("line, level, service", [
    ("2026-10-01 09:01:10,000 ERROR [payment-service] Pool exhausted", "ERROR", "payment-service"),
    ("2026-10-01T09:01:10Z [WARN] db-proxy: pool at 92%", "WARN", "db-proxy"),
    ("2026-10-01 09:01:10,123 - app.db - CRITICAL - disk full", "FATAL", "app.db"),
    ("ERROR:app.worker:job 7 failed", "ERROR", "app.worker"),
    ("2015-10-18 18:01:47,978 INFO [main] org.apache.hadoop.mapreduce.v2.app.MRAppMaster: Created", "INFO", "MRAppMaster"),
    ("081109 203615 148 INFO dfs.DataNode$PacketResponder: PacketResponder 1 terminating", "INFO", "DataNode$PacketResponder"),
    ("17/06/09 20:10:40 INFO spark.SecurityManager: Changing view acls", "INFO", "SecurityManager"),
    ("2015-07-29 17:41:44,747 - WARN  [QuorumPeer[myid=1]/0:0:0:0:0:0:0:0:2181:FastLeaderElection@774] - Notification",
     "WARN", "FastLeaderElection"),
    ("03-17 16:13:38.811  1702  2395 E WindowManager: crash", "ERROR", "WindowManager"),
    ("[Sun Dec 04 04:47:44 2005] [error] mod_jk child workerEnv in error state 6", "ERROR", None),
    ("Jun 14 15:16:01 combo sshd(pam_unix)[19939]: authentication failure; logname= uid=0", "ERROR", "sshd(pam_unix)"),
    ("2016-09-28 04:30:30, Warning               CBS    Failed to load", "WARN", "CBS"),
    ("20171223-22:15:29:606|Step_LSC|30002312|onStandStepChanged 3579", "INFO", "Step_LSC"),
])
def test_known_formats(line, level, service):
    result = parse_log(line)
    assert result.unparsed_lines == 0
    entry = result.entries[0]
    assert entry.level == level
    assert entry.service == service
    assert entry.timestamp is not None or line.startswith("ERROR:")


def test_exception_name_is_not_a_service():
    entry = parse_log("2026-10-01 09:00:00 ERROR [order-service] java.lang.OutOfMemoryError: Java heap space").entries[0]
    assert entry.service == "order-service"


def test_java_stack_trace_is_folded_into_one_entry():
    text = (
        "2026-10-01 09:00:00 ERROR [api] Request failed\n"
        "java.lang.IllegalStateException: boom\n"
        "\tat com.shop.Api.handle(Api.java:10)\n"
        "Caused by: java.io.IOException: closed\n"
        "\t... 3 more\n"
        "2026-10-01 09:00:01 INFO [api] next request\n"
    )
    result = parse_log(text)
    assert len(result.entries) == 2
    assert result.entries[0].raw.count("\n") == 4
    assert result.parsed_lines == 6 and result.unparsed_lines == 0


def test_python_traceback_is_folded():
    text = (
        "2026-10-01 09:00:00,000 ERROR [worker] Task crashed\n"
        "Traceback (most recent call last):\n"
        '  File "worker.py", line 3, in run\n'
        "ValueError: bad input\n"
    )
    result = parse_log(text)
    assert len(result.entries) == 1 and result.unparsed_lines == 0


def test_unknown_lines_are_counted_not_crashing():
    text = "=== header ===\n\n2026-10-01 09:00:00 INFO [a] ok\nrandom garbage line\n" + "x" * 100_000 + "\n"
    result = parse_log(text)
    assert len(result.entries) == 1
    assert result.unparsed_lines == 3
    assert result.total_lines == result.parsed_lines + result.unparsed_lines == 4


def test_empty_and_weird_input():
    assert parse_log("").entries == []
    result = parse_log("��\x01\x02 not a log\n2026-99-99 99:99:99 ERROR [a] bad date")
    assert result.entries[-1].timestamp is None  # impossible date: kept, but without a timestamp


@pytest.mark.parametrize("path", sorted(LOGHUB.glob("*.log")), ids=lambda p: p.stem)
def test_loghub_slices_parse(path):
    result = parse_log(path.read_text(encoding="utf-8"))
    assert result.total_lines == result.parsed_lines + result.unparsed_lines
    assert result.parsed_lines / result.total_lines >= 0.95
    assert sum(e.timestamp is not None for e in result.entries) / len(result.entries) >= 0.95
