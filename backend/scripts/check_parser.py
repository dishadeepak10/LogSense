"""Quick manual check: parse every Loghub fixture and print what came out.

Run from backend/:  ./venv/Scripts/python scripts/check_parser.py
"""
import collections
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.parser import parse_log  # noqa: E402

for path in sorted(glob.glob("tests/fixtures/loghub/*.log")):
    result = parse_log(open(path, encoding="utf-8").read())
    levels = collections.Counter(e.level for e in result.entries)
    no_ts = sum(e.timestamp is None for e in result.entries)
    no_svc = sum(e.service is None for e in result.entries)
    print(f"{os.path.basename(path):15} parsed {result.parsed_lines}/{result.total_lines} "
          f"unparsed {result.unparsed_lines} no_ts {no_ts} no_svc {no_svc} {dict(levels)}")
    if result.entries:
        e = result.entries[0]
        print(f"{'':15} -> {e.timestamp} {e.level} svc={e.service!r} msg={e.message[:70]!r}")
