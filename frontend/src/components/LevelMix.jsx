import { useAppeared } from '../hooks/useCountUp'

// One bar showing what share of the log is normal lines, warnings, errors and fatal errors.
// Colors were checked for color-blind separation in both dark and light mode;
// DEBUG and INFO are grouped as gray "normal" lines because they are rarely interesting.
const SEGMENTS = [
  { key: 'normal', label: 'Normal', color: '#71717a' },
  { key: 'WARN', label: 'WARN', color: '#c98500' },
  { key: 'ERROR', label: 'ERROR', color: '#d03b3b' },
  { key: 'FATAL', label: 'FATAL', color: '#9085e9' },
]

export default function LevelMix({ levelCounts }) {
  const appeared = useAppeared()
  const counts = { ...levelCounts, normal: levelCounts.DEBUG + levelCounts.INFO }
  const total = SEGMENTS.reduce((sum, s) => sum + counts[s.key], 0)

  if (total === 0) return <p className="text-sm text-zinc-400">No log levels found.</p>

  return (
    <div>
      {/* the bar; a small gap separates the parts */}
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-zinc-800">
        {SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => {
          const percent = (counts[s.key] / total) * 100
          return (
            <div
              key={s.key}
              title={`${s.label}: ${counts[s.key]} (${percent.toFixed(1)}%)`}
              className="h-full transition-[width] duration-700 ease-out first:rounded-l-full last:rounded-r-full"
              style={{ width: appeared ? `${Math.max(percent, 1)}%` : '0%', background: s.color }}
            />
          )
        })}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">Normal = DEBUG + INFO lines</p>
      {/* legend with numbers, so the colors are never the only way to read it */}
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-zinc-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="tabular-nums text-zinc-400">{counts[s.key].toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
