"""Builds a downloadable Markdown report for one analyzed file."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import LogFile
from app.services.views import analysis_result


def _time(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return "-"


def _cell(text) -> str:
    """Make text safe inside a Markdown table cell."""
    return str(text if text is not None else "-").replace("|", "\\|").replace("\n", " ")


def build_markdown_report(db: Session, log_file: LogFile) -> str:
    result = analysis_result(db, log_file)
    summary, incidents = result["summary"], result["incidents"]
    levels = summary["level_counts"]
    lines = [
        f"# LogSense report: {log_file.file_name}",
        "",
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}. "
        f"Log covers {_time(summary['start_time'])} to {_time(summary['end_time'])}.",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Lines (parsed / total) | {summary['parsed_lines']} / {summary['total_lines']} |",
        f"| Unparsed lines | {summary['unparsed_lines']} |",
        f"| Errors (ERROR + FATAL) | {summary['error_count']} |",
        f"| Warnings | {summary['warning_count']} |",
        f"| Levels | " + ", ".join(f"{k} {v}" for k, v in levels.items()) + " |",
        f"| Services | {_cell(', '.join(summary['services']) or '-')} |",
        f"| Incidents | {len(incidents)} |",
        "",
    ]

    if summary["top_error_groups"]:
        lines += ["## Most frequent errors", "", "| Count | Level | Template |", "|---|---|---|"]
        lines += [f"| {g['count']} | {g['level']} | {_cell(g['template'])} |" for g in summary["top_error_groups"]]
        lines.append("")

    lines += ["## Incidents", ""]
    if not incidents:
        lines += ["No incidents were detected.", ""]
    for number, incident in enumerate(incidents, start=1):
        analysis = incident["analysis"] or {}
        lines += [
            f"### {number}. {incident['title']}",
            "",
            f"- **Severity:** {incident['severity']}",
            f"- **Category:** {incident['category']}",
            f"- **Time:** {_time(incident['start_time'])} to {_time(incident['end_time'])}",
            f"- **Errors:** {incident['error_count']}",
            f"- **Candidate trigger** (line {incident['candidate_trigger_line']}): "
            f"`{(incident['candidate_trigger'] or '-').replace('`', chr(39))}`",
            "",
            f"**Probable root cause:** {analysis.get('root_cause', '-')}",
            "",
            f"**Why:** {analysis.get('why', '-')}",
            "",
            f"**Suggested action:** {analysis.get('suggested_action', '-')}",
            "",
            f"Confidence: {analysis.get('confidence', '-')} (source: {analysis.get('source', '-')})",
            "",
        ]
        if incident["service_timeline"]:
            lines += ["| Service | First error | Errors |", "|---|---|---|"]
            lines += [
                f"| {_cell(s['service'])} | {_time(s['first_error'])} | {s['error_count']} |"
                for s in incident["service_timeline"]
            ]
            lines.append("")
        if incident["similar_incidents"]:
            lines.append("Similar past incidents: " + ", ".join(
                f"#{s['incident_id']} in {s['file_name']} ({round(s['similarity'] * 100)}%)"
                for s in incident["similar_incidents"]
            ))
            lines.append("")
    return "\n".join(lines)
