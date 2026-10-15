import { useState } from 'react'

import { useAppeared } from '../hooks/useCountUp'
import { formatClock, formatDuration, formatLogTime, logTimeMs } from '../utils/format'

const MARKER_COLOR = '#3987e5'

// Failure timeline: one row per service, a dot where that service logged its first error.
// The track runs from the incident's start to its end, so you can see how the failure spread.
// Bigger dot = more errors from that service. The dots slide in one after another,
// and the service that broke first gets a pulsing ring.
export default function ServiceTimeline({ rows, startTime, endTime }) {
  const appeared = useAppeared()
  const [hovered, setHovered] = useState(null)
  if (!rows.length) return <p className="text-sm text-slate-400">No service information in this incident.</p>

  const start = logTimeMs(startTime)
  const end = logTimeMs(endTime)
  const span = start != null && end != null ? Math.max(end - start, 1) : null
  const firstErrorMs = Math.min(...rows.map((r) => logTimeMs(r.first_error) ?? Infinity))
  const maxErrors = Math.max(...rows.map((r) => r.error_count), 1)

  return (
    <div>
      <div className="space-y-1">
        {rows.map((row, i) => {
          const at = logTimeMs(row.first_error)
          const percent = at != null && span ? ((at - start) / span) * 100 : null
          const size = 12 + 14 * Math.sqrt(row.error_count / maxErrors) // area grows with the count
          const isFirst = at != null && at === firstErrorMs
          const isHovered = hovered === row.service
          return (
            <div
              key={row.service}
              onMouseEnter={() => setHovered(row.service)}
              onMouseLeave={() => setHovered(null)}
              className={`grid grid-cols-[1fr_7rem] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 transition sm:grid-cols-[9rem_1fr_8rem] ${
                isHovered ? 'bg-white/5' : ''
              }`}
            >
              <span className="col-span-2 truncate text-sm font-medium sm:col-span-1" title={row.service}>
                {row.service}
              </span>
              <div className="relative h-8">
                <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-slate-700" />
                {percent != null && (
                  <span
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700 ease-out"
                    style={{ left: appeared ? `${percent}%` : '0%', transitionDelay: `${i * 120}ms` }}
                  >
                    {isFirst && (
                      <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: MARKER_COLOR }} />
                    )}
                    <span
                      className={`relative block rounded-full ring-2 ring-slate-900 transition-transform ${isHovered ? 'scale-125' : ''}`}
                      style={{ width: size, height: size, background: MARKER_COLOR }}
                    />
                    {isHovered && (
                      <span className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-100 shadow-lg ring-1 ring-white/10">
                        {formatLogTime(row.first_error)} · {row.error_count} errors
                      </span>
                    )}
                  </span>
                )}
              </div>
              <span className="text-right text-xs text-slate-400 tabular-nums">
                {at == null
                  ? 'warnings only'
                  : `${isFirst ? 'broke first' : `+${formatDuration(at - firstErrorMs)}`} · ${row.error_count} err`}
              </span>
            </div>
          )
        })}
      </div>
      {span && (
        <div className="mt-2 grid grid-cols-[1fr_7rem] gap-x-3 px-2 text-xs text-slate-400 sm:grid-cols-[9rem_1fr_8rem]">
          <span className="hidden sm:block" />
          <div className="flex justify-between">
            <span>{formatClock(startTime)}</span>
            <span>{formatClock(endTime)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
