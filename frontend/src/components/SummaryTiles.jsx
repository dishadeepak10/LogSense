// Headline numbers for one file. Plain tiles: a single number does not need a chart.

function Tile({ label, value, note }) {
  return (
    <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
    </div>
  )
}

export default function SummaryTiles({ summary }) {
  const levels = summary.level_counts
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Tile
        label="Lines"
        value={summary.total_lines.toLocaleString()}
        note={`${summary.parsed_lines.toLocaleString()} parsed, ${summary.unparsed_lines} not recognized`}
      />
      <Tile label="Errors" value={summary.error_count} note={`${levels.ERROR} ERROR, ${levels.FATAL} FATAL`} />
      <Tile label="Warnings" value={summary.warning_count} />
      <Tile label="Incidents" value={summary.incident_count} />
      <Tile label="Services" value={summary.services.length} note={summary.services.slice(0, 3).join(', ')} />
    </div>
  )
}
