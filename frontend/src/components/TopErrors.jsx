import { useAppeared } from '../hooks/useCountUp'
import { LEVEL_STYLES, formatLogTime } from '../utils/format'

// The most frequent error patterns, each with a bar showing its share compared to the biggest one.
export default function TopErrors({ groups }) {
  const appeared = useAppeared()
  if (groups.length === 0) return <p className="text-sm text-zinc-400">No ERROR or FATAL lines in this log.</p>
  const biggest = Math.max(...groups.map((g) => g.count))

  return (
    <ol className="space-y-2">
      {groups.map((group, i) => (
        <li key={`${group.template}-${group.level}`} className="group rounded-lg p-2 transition hover:bg-white/5" title={group.example}>
          <div className="flex items-start gap-3">
            <span className="w-6 shrink-0 pt-0.5 text-right text-sm font-semibold text-zinc-500">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="break-all font-mono text-xs text-zinc-200">{group.template}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-red-500/80 transition-[width] duration-700 ease-out"
                    style={{ width: appeared ? `${(group.count / biggest) * 100}%` : '0%', transitionDelay: `${i * 60}ms` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{group.count}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                <span className={`mr-2 rounded px-1 font-semibold ${LEVEL_STYLES[group.level] || ''}`}>{group.level}</span>
                first seen {formatLogTime(group.first_seen)}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
