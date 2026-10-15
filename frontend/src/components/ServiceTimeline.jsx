import { formatClock, formatDuration, formatLogTime, logTimeMs } from '../utils/format'

const MARKER_COLOR = '#3987e5'

// Failure timeline: one row per service, a dot where that service logged its first error.
// The track runs from the incident's start to its end, so you can see how the failure spread.
// Bigger dot = more errors from that service.
export default function ServiceTimeline({ rows, startTime, endTime }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No service information in this incident.</p>

  const start = logTimeMs(startTime)
  const end = logTimeMs(endTime)
  const span = start != null && end != null ? Math.max(end - start, 1) : null
  const firstErrorMs = Math.min(...rows.map((r) => logTimeMs(r.first_error) ?? Infinity))
  const maxErrors = Math.max(...rows.map((r) => r.error_count), 1)

  return (
    <div>
      <div className="space-y-3">
        {rows.map((row) => {
          const at = logTimeMs(row.first_error)
          const percent = at != null && span ? ((at - start) / span) * 100 : null
          const size = 10 + 12 * Math.sqrt(row.error_count / maxErrors) // area grows with the count
          return (
            <div key={row.service} className="grid grid-cols-[1fr_7rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr_8rem]">
              <span className="col-span-2 truncate text-sm font-medium sm:col-span-1" title={row.service}>
                {row.service}
              </span>
              <div className="relative h-6">
                <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-slate-700" />
                {percent != null && (
                  <span
                    title={`${row.service}: first error ${formatLogTime(row.first_error)}, ${row.error_count} errors`}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-slate-900"
                    style={{ left: `${percent}%`, width: size, height: size, background: MARKER_COLOR }}
                  />
                )}
              </div>
              <span className="text-right text-xs text-slate-400 tabular-nums">
                {at == null
                  ? 'warnings only'
                  : `${at === firstErrorMs ? 'first' : `+${formatDuration(at - firstErrorMs)}`} · ${row.error_count} err`}
              </span>
            </div>
          )
        })}
      </div>
      {span && (
        <div className="mt-2 grid grid-cols-[1fr_7rem] gap-x-3 text-xs text-slate-400 sm:grid-cols-[9rem_1fr_8rem]">
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
