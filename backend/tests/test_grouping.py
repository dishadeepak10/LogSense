from app.services.grouping import add_templates, group_entries, make_template
from app.services.parser import parse_log


def test_variable_parts_are_masked():
    assert make_template("Connection to 10.0.0.5:5432 timed out after 3000 ms") == \
        "Connection to <IP> timed out after <*> ms"
    assert make_template("req 3f2a1b4c-1111-2222-3333-444455556666 failed") == "req <UUID> failed"
    assert make_template("flags=0x1f block blk_-6952295868487656571") == "flags=<HEX> block <*>"
    assert make_template("Invalid token for user admin") == "Invalid token for user admin"


def test_similar_messages_share_a_template():
    a = make_template("Order 5001 failed after 3 retries")
    b = make_template("Order 72 failed after 10 retries")
    assert a == b


def test_group_entries_counts_by_template_and_level():
    entries = parse_log(
        "2026-10-01 09:00:00 ERROR [a] Order 1 failed\n"
        "2026-10-01 09:00:05 ERROR [b] Order 2 failed\n"
        "2026-10-01 09:00:09 INFO [a] Order 3 failed\n"
    ).entries
    add_templates(entries)
    groups = group_entries(entries)
    top = groups[0]
    assert (top.template, top.level, top.count) == ("Order <*> failed", "ERROR", 2)
    assert top.services == {"a", "b"}
    assert top.first_seen < top.last_seen
