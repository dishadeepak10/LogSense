"""Turns raw log text into structured entries.

How it works:
1. Each line is tried against a list of known log formats (regular expressions).
   The first one that matches starts a new entry.
2. A line that matches no format but looks like part of the previous entry
   (indented, "at ...", "Caused by:", "SomethingError: ...") is a continuation
   line, e.g. a stack trace. It is appended to the previous entry's `raw` text.
3. Every other non-empty line is counted as unparsed. Nothing ever raises.

Formats cover typical application logs plus the Loghub datasets
(HDFS, Hadoop, Spark, Zookeeper, BGL, HPC, Thunderbird, Windows, Linux,
Android, HealthApp, Apache, Proxifier, OpenSSH, OpenStack, Mac).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

ERROR_LEVELS = {"ERROR", "FATAL"}
MAX_CONTINUATION_LINES = 200  # stop folding after this many, so one entry can't swallow a whole file

_LEVEL_MAP = {
    "TRACE": "DEBUG", "DEBUG": "DEBUG", "V": "DEBUG", "D": "DEBUG",
    "INFO": "INFO", "I": "INFO", "NOTICE": "INFO",
    "WARN": "WARN", "WARNING": "WARN", "W": "WARN",
    "ERROR": "ERROR", "ERR": "ERROR", "E": "ERROR", "SEVERE": "ERROR", "FAILURE": "ERROR",
    "FATAL": "FATAL", "F": "FATAL", "CRITICAL": "FATAL", "CRIT": "FATAL", "ALERT": "FATAL", "EMERG": "FATAL",
}
_LEVEL_WORDS = r"TRACE|DEBUG|INFO|NOTICE|WARNING|WARN|ERROR|ERR|SEVERE|CRITICAL|CRIT|FATAL|ALERT|EMERG"

# For formats without a level field: guess it from the message.
_ERROR_HINT = re.compile(
    r"\b(error|errors|fail|failed|failure|exception|fatal|panic|denied|refused|timed out|timeout|"
    r"unreachable|corrupt\w*|critical|break-in|invalid user|authentication failure|abort\w*|killed)\b",
    re.IGNORECASE,
)
_WARN_HINT = re.compile(r"\b(warn|warning|retry|retrying|deprecated|slow|unavailable|unable)\b", re.IGNORECASE)

_CONTINUATION = re.compile(
    r"^(\s+"                                   # indented (most stack trace lines)
    r"|at\s"                                   # Java frame without indent
    r"|Caused by:"                             # Java cause
    r"|\.\.\. \d+ more"                        # Java "... 12 more"
    r"|Traceback \(most recent call last\)"    # Python traceback start
    r"|Exception in thread"
    r"|[\w.$]+(Exception|Error|Interrupt|Timeout|Warning|Fault)(:|$)"  # e.g. ValueError, UpstreamTimeout, KeyboardInterrupt
    r"|[\w.]+\.[A-Z][\w]*(:|$)"               # dotted path: clients.errors.UpstreamTimeout:
    r"|[}\]])"                                 # closing brace of a multi-line JSON/dict dump
)


@dataclass
class ParsedEntry:
    line_number: int
    timestamp: datetime | None
    level: str
    service: str | None
    message: str
    raw: str
    template: str | None = None  # filled in by grouping.add_templates
    index: int = 0               # position in the entries list
    continuation_lines: int = 0

    @property
    def is_error(self) -> bool:
        return self.level in ERROR_LEVELS


@dataclass
class ParseResult:
    entries: list[ParsedEntry] = field(default_factory=list)
    total_lines: int = 0      # non-empty lines in the file
    parsed_lines: int = 0     # lines that ended up in an entry (including continuation lines)
    unparsed_lines: int = 0   # total_lines - parsed_lines


# ---------- small helpers ----------

def normalize_level(word: str | None, message: str) -> str:
    """Map many level spellings to DEBUG/INFO/WARN/ERROR/FATAL, or guess from the message."""
    if word:
        level = _LEVEL_MAP.get(word.strip().upper())
        if level:
            return level
    if _ERROR_HINT.search(message):
        return "ERROR"
    if _WARN_HINT.search(message):
        return "WARN"
    return "INFO"


def _strptime(text: str, *formats: str) -> datetime | None:
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _iso(text: str) -> datetime | None:
    text = text.replace("T", " ").replace(",", ".")
    if "." in text:  # strptime accepts at most 6 fraction digits
        head, fraction = text.split(".", 1)
        text = f"{head}.{fraction[:6]}"
    return _strptime(text, "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S")


def _no_year(text: str, fmt: str) -> datetime | None:
    """For formats without a year (syslog, Android, Proxifier): assume the current year."""
    year = datetime.now(timezone.utc).year
    return _strptime(f"{year} {' '.join(text.split())}", f"%Y {fmt}")


def _epoch(text: str) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(text), tz=timezone.utc).replace(tzinfo=None)
    except (ValueError, OverflowError, OSError):
        return None


_NOT_SERVICES = {"error", "exception", "warning", "warn", "info", "note", "caused", "fatal", "debug"}


def _short_service(name: str | None) -> str | None:
    if not name:
        return None
    name = re.sub(r"\[\d+\]$", "", name.strip())  # drop "[pid]"
    if not name or name.lower() in _NOT_SERVICES:
        return None
    if re.search(r"(Exception|Error|Throwable)$", name):  # "java.lang.OutOfMemoryError: ..." is a message
        return None
    # Java class names: keep only the class, e.g. org.apache.x.MRAppMaster -> MRAppMaster
    last = name.rsplit(".", 1)[-1]
    if "." in name and last[:1].isupper():
        name = last
    return name[:100]


def _matching_bracket(text: str) -> int:
    """Index of the ']' that closes the '[' at text[0], allowing nested brackets."""
    depth = 0
    for i, char in enumerate(text):
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return i
    return -1


_SVC_COLON = re.compile(r"^(?P<svc>[A-Za-z_][\w.$/-]*(?:\([\w.-]*\))?(?:\[\d+\])?):\s+(?P<msg>.*)$", re.S)
_SVC_DASH = re.compile(r"^(?P<svc>[A-Za-z_][\w.-]*)\s+-\s+(?P<msg>.*)$", re.S)
_SVC_DOTTED = re.compile(r"^(?P<svc>[a-z_][\w-]*(?:\.[\w-]+)+)\s+(?P<msg>\[.*)$", re.S)  # OpenStack
_SVC_COLUMN = re.compile(r"^(?P<svc>[A-Za-z][\w.-]*)\s{2,}(?P<msg>.*)$", re.S)           # Windows "CBS    msg"
_SVC_AT_LINE = re.compile(r":?([A-Za-z_]\w*)@\d+$")                                       # Zookeeper "...:Name@774"


def split_service(rest: str) -> tuple[str | None, str]:
    """Split 'what comes after the level' into (service, message)."""
    rest = rest.strip()
    bracket = None
    if rest.startswith("["):
        end = _matching_bracket(rest)
        if end > 0:
            bracket, rest = rest[1:end], rest[end + 1:].lstrip()
            if rest.startswith("- "):
                rest = rest[2:]
    if bracket:
        found = _SVC_AT_LINE.search(bracket)
        if found:
            return found.group(1), rest
    for pattern in (_SVC_COLON, _SVC_DASH, _SVC_DOTTED, _SVC_COLUMN):
        found = pattern.match(rest)
        if found:
            service = _short_service(found["svc"])
            if service:
                return service, found["msg"].strip()
    if bracket and re.fullmatch(r"[A-Za-z][\w.-]*", bracket) and bracket.lower() != "main":
        return bracket, rest  # "[payment-service] message"
    return None, rest


# ---------- the formats ----------

Builder = Callable[[re.Match], tuple]  # returns (timestamp, level_word, service, message)


def _rest_builder(ts_func: Callable) -> Builder:
    """For formats where service and message still need splitting."""
    def build(m: re.Match) -> tuple:
        service, message = split_service(m["rest"] or "")
        return ts_func(m), m.groupdict().get("level"), service, message
    return build


def _fixed_builder(ts_func: Callable, level_func: Callable = lambda m: None) -> Builder:
    """For formats where the regex already captures service and message."""
    def build(m: re.Match) -> tuple:
        return ts_func(m), level_func(m), _short_service(m["svc"]), m["msg"].strip()
    return build


_ISO_TS = r"\[?(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?)(?:Z|[+-]\d{2}:?\d{2})?\]?"

FORMATS: list[tuple[str, re.Pattern, Builder]] = [
    # 2026-10-10 12:00:01,123 ERROR [payment-service] msg  (also Hadoop, Zookeeper, Windows, OpenStack)
    ("iso", re.compile(
        rf"^(?:\S+\.log\S*\s+)?{_ISO_TS}[\s,]+(?:-\s+)?(?:\d+\s+)?\[?(?P<level>{_LEVEL_WORDS})\b\]?:?"
        rf"(?:\s+-)?(?:\s+(?P<rest>.*))?$",
        re.IGNORECASE),
     _rest_builder(lambda m: _iso(m["ts"]))),
    # Python logging: 2026-10-10 12:00:01,123 - app.db - ERROR - msg
    ("iso_python", re.compile(
        rf"^{_ISO_TS}\s+-\s+(?P<svc>[\w.-]+)\s+-\s+(?P<level>{_LEVEL_WORDS})\s+-\s+(?P<msg>.*)$", re.IGNORECASE),
     _fixed_builder(lambda m: _iso(m["ts"]), lambda m: m["level"])),
    # HDFS: 081109 203615 148 INFO dfs.DataNode$PacketResponder: msg
    ("hdfs", re.compile(r"^(?P<d>\d{6}) (?P<t>\d{6}) \d+ (?P<level>[A-Z]+) (?P<rest>.*)$"),
     _rest_builder(lambda m: _strptime(m["d"] + m["t"], "%y%m%d%H%M%S"))),
    # Spark: 17/06/09 20:10:40 INFO spark.SecurityManager: msg
    ("spark", re.compile(r"^(?P<ts>\d{2}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}) (?P<level>[A-Z]+) (?P<rest>.*)$"),
     _rest_builder(lambda m: _strptime(m["ts"], "%y/%m/%d %H:%M:%S"))),
    # Android: 03-17 16:13:38.811  1702  2395 D WindowManager: msg
    ("android", re.compile(
        r"^(?P<ts>\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+\d+\s+\d+ (?P<level>[VDIWEF]) (?P<rest>.*)$"),
     _rest_builder(lambda m: _no_year(m["ts"], "%m-%d %H:%M:%S.%f"))),
    # Apache: [Sun Dec 04 04:47:44 2005] [error] msg
    ("apache", re.compile(
        r"^\[(?P<ts>\w{3} \w{3} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4})\] \[(?P<level>\w+)\] (?P<rest>.*)$"),
     _rest_builder(lambda m: _strptime(" ".join(m["ts"].split()), "%a %b %d %H:%M:%S %Y"))),
    # BGL: - 1117838570 2005.06.03 R02-M1-N0 2005-06-03-15.42.50.675872 R02-M1-N0 RAS KERNEL INFO msg
    ("bgl", re.compile(
        r"^(?P<label>\S+) (?P<epoch>\d{10}) \d{4}\.\d{2}\.\d{2} \S+ \d{4}-\d{2}-\d{2}-[\d.]+ \S+ \w+ "
        r"(?P<svc>\w+) (?P<level>\w+) (?P<msg>.*)$"),
     _fixed_builder(lambda m: _epoch(m["epoch"]), lambda m: m["level"])),
    # Thunderbird: - 1131566461 2005.11.09 dn228 Nov 9 12:01:01 dn228/dn228 crond(pam_unix)[2915]: msg
    # The first field is Loghub's alert label: "-" means normal, anything else is an alert.
    ("thunderbird", re.compile(
        r"^(?P<label>\S+) (?P<epoch>\d{10}) \d{4}\.\d{2}\.\d{2} \S+ \w{3} +\d+ [\d:]+ \S+ "
        r"(?P<svc>[^:\[]+?)(?:\[\d+\])?: ?(?P<msg>.*)$"),
     _fixed_builder(lambda m: _epoch(m["epoch"]), lambda m: None if m["label"] == "-" else "ERROR")),
    # HPC: 134681 node-246 unix.hw state_change.unavailable 1077804742 1 msg
    ("hpc", re.compile(r"^\d+ \S+ (?P<svc>\S+) \S+ (?P<epoch>\d{10}) \d+ (?P<msg>.*)$"),
     _fixed_builder(lambda m: _epoch(m["epoch"]))),
    # HealthApp: 20171223-22:15:29:606|Step_LSC|30002312|msg
    ("healthapp", re.compile(r"^(?P<ts>\d{8}-\d{1,2}:\d{1,2}:\d{1,2}):\d{1,3}\|(?P<svc>[^|]+)\|\d+\|(?P<msg>.*)$"),
     _fixed_builder(lambda m: _strptime(m["ts"], "%Y%m%d-%H:%M:%S"))),
    # Proxifier: [10.30 16:49:06] chrome.exe - msg
    ("proxifier", re.compile(r"^\[(?P<ts>\d{2}\.\d{2} \d{2}:\d{2}:\d{2})\] (?P<svc>\S+) - (?P<msg>.*)$"),
     _fixed_builder(lambda m: _no_year(m["ts"], "%m.%d %H:%M:%S"))),
    # Syslog (Linux, OpenSSH, Mac): Jun 14 15:16:01 combo sshd(pam_unix)[19939]: msg
    ("syslog", re.compile(
        r"^(?P<ts>[A-Z][a-z]{2} +\d{1,2} \d{2}:\d{2}:\d{2}) \S+ (?P<svc>[^:\[]+?)(?:\[\d+\])?(?: \(\[\d+\]\))?: ?"
        r"(?P<msg>.*)$"),
     _fixed_builder(lambda m: _no_year(m["ts"], "%b %d %H:%M:%S"))),
    # Python default format: ERROR:app.db:msg
    ("python_basic", re.compile(rf"^(?P<level>{_LEVEL_WORDS}):(?P<svc>[\w.]+):(?P<msg>.*)$"),
     _fixed_builder(lambda m: None, lambda m: m["level"])),
    # Last resort: a timestamp with no recognizable level
    ("iso_no_level", re.compile(rf"^{_ISO_TS}[\s,]+(?:-\s+)?(?P<rest>.*)$"),
     _rest_builder(lambda m: _iso(m["ts"]))),
]


def _try_formats(line: str, formats: list) -> tuple | None:
    for position, (_name, pattern, build) in enumerate(formats):
        match = pattern.match(line)
        if not match:
            continue
        try:
            result = build(match)
        except Exception:  # a broken builder must never crash an upload
            continue
        if position:  # most files use one format: try it first next time
            formats.insert(0, formats.pop(position))
        return result
    return None


def parse_log(text: str) -> ParseResult:
    result = ParseResult()
    formats = list(FORMATS)  # private copy, reordered as we learn this file's format
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        result.total_lines += 1
        line = line.rstrip()

        parsed = _try_formats(line, formats)
        if parsed:
            timestamp, level_word, service, message = parsed
            result.entries.append(ParsedEntry(
                line_number=line_number,
                timestamp=timestamp,
                level=normalize_level(level_word, message),
                service=service,
                message=message,
                raw=line,
                index=len(result.entries),
            ))
            result.parsed_lines += 1
            continue

        last = result.entries[-1] if result.entries else None
        if last and _CONTINUATION.match(line) and last.continuation_lines < MAX_CONTINUATION_LINES:
            last.raw += "\n" + line
            last.continuation_lines += 1
            result.parsed_lines += 1
        else:
            result.unparsed_lines += 1
    return result
