import { useCountUp } from '../hooks/useCountUp'

// Headline numbers for one file. Plain tiles: a single number does not need a chart.
// The numbers count up when the page opens, and the tiles slide in one after another.

function Tile({ label, value, note, accent, delay }) {
  const shown = useCountUp(value)
  return (
    <div className="card rise group relative overflow-hidden p-4" style={{ animationDelay: `${delay}ms` }}>
      {/* thin colored line on top of the tile */}
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accent} opacity-70 transition group-hover:opacity-100`} />
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{shown.toLocaleString()}</p>
      {note && <p className="mt-0.5 text-xs text-zinc-400">{note}</p>}
    </div>
  )
}

export default function SummaryTiles({ summary }) {
  const levels = summary.level_counts
  const tiles = [
    { label: 'Lines', value: summary.total_lines, accent: 'bg-accent-1',
      note: `${summary.parsed_lines.toLocaleString()} parsed, ${summary.unparsed_lines} not recognized` },
    { label: 'Errors', value: summary.error_count, accent: 'bg-red-500', note: `${levels.ERROR} ERROR, ${levels.FATAL} FATAL` },
    { label: 'Warnings', value: summary.warning_count, accent: 'bg-amber-500' },
    { label: 'Incidents', value: summary.incident_count, accent: 'bg-accent-2' },
    { label: 'Services', value: summary.services.length, accent: 'bg-accent-dot', note: summary.services.slice(0, 3).join(', ') },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {tiles.map((tile, i) => <Tile key={tile.label} {...tile} delay={i * 70} />)}
    </div>
  )
}
