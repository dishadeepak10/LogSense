import { useAppeared, useCountUp } from '../hooks/useCountUp'

// Headline numbers for one file. The numbers count up when the page opens,
// the tiles slide in one after another, and errors/warnings show a tiny trend line.

const ICONS = {
  lines: 'M4 6h16M4 10h16M4 14h10M4 18h7',
  errors: 'M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  warnings: 'M12 8v5m0 3h.01M12 3a9 9 0 100 18 9 9 0 000-18z',
  incidents: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  services: 'M5 5h14v5H5zM5 14h14v5H5zM8 7.5h.01M8 16.5h.01',
}

function Icon({ name, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// A tiny line chart with no axes: only the shape of the trend matters here.
function Sparkline({ values, color }) {
  if (values.length < 2 || Math.max(...values) === 0) return null
  const max = Math.max(...values)
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - (v / max) * 24}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-2 h-8 w-full" aria-hidden="true">
      <polygon points={`0,30 ${points} 100,30`} fill={color} fillOpacity="0.15" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Tile({ label, value, note, icon, tone, delay, children }) {
  const shown = useCountUp(value)
  return (
    <div className="card rise group relative overflow-hidden p-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-zinc-400">{label}</p>
        <span className={`rounded-lg p-1.5 transition group-hover:scale-110 ${tone}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-1 text-3xl font-bold tabular-nums">{shown.toLocaleString()}</p>
      {note && <p className="mt-0.5 truncate text-xs text-zinc-400" title={note}>{note}</p>}
      {children}
    </div>
  )
}

function ParsedBar({ parsed, total }) {
  const appeared = useAppeared()
  const percent = total ? Math.round((parsed / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-accent-1 transition-[width] duration-700 ease-out" style={{ width: appeared ? `${percent}%` : '0%' }} />
      </div>
      <p className="mt-1 text-xs text-zinc-500">{percent}% understood by the parser</p>
    </div>
  )
}

export default function SummaryTiles({ summary }) {
  const levels = summary.level_counts
  const errorTrend = summary.error_timeline.map((b) => b.errors)
  const warningTrend = summary.error_timeline.map((b) => b.warnings)
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Tile label="Lines" value={summary.total_lines} icon="lines" tone="bg-accent-1/15 text-accent-soft" delay={0}
        note={`${summary.unparsed_lines} not recognized`}>
        <ParsedBar parsed={summary.parsed_lines} total={summary.total_lines} />
      </Tile>
      <Tile label="Errors" value={summary.error_count} icon="errors" tone="bg-red-950 text-red-300" delay={70}
        note={`${levels.ERROR} ERROR, ${levels.FATAL} FATAL`}>
        <Sparkline values={errorTrend} color="#d03b3b" />
      </Tile>
      <Tile label="Warnings" value={summary.warning_count} icon="warnings" tone="bg-amber-950 text-amber-300" delay={140}>
        <Sparkline values={warningTrend} color="#c98500" />
      </Tile>
      <Tile label="Incidents" value={summary.incident_count} icon="incidents" tone="bg-orange-950 text-orange-300" delay={210}
        note={summary.incident_count ? 'grouped from anomalies' : 'nothing unusual found'} />
      <Tile label="Services" value={summary.services.length} icon="services" tone="bg-zinc-800 text-zinc-300" delay={280}
        note={summary.services.join(', ')} />
    </div>
  )
}
