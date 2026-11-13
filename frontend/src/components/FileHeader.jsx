import { formatBytes, formatDuration, formatLogTime, formatUtc, logTimeMs, SEVERITY_ORDER, SEVERITY_STYLES } from '../utils/format'
import ReportButton from './ReportButton'

// Top banner of the dashboard: file name, metadata chips, health status.

function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
      {children}
    </span>
  )
}

function HealthPill({ incidents }) {
  if (incidents.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-emerald-800/60 bg-emerald-950/50 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Healthy — no incidents
      </span>
    )
  }
  const worst = SEVERITY_ORDER.find((s) => incidents.some((i) => i.severity === s)) || 'low'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium ring-0 ${SEVERITY_STYLES[worst]}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {incidents.length} incident{incidents.length === 1 ? '' : 's'} · worst: {worst}
    </span>
  )
}

export default function FileHeader({ file, summary, incidents }) {
  const start = logTimeMs(summary.start_time)
  const end = logTimeMs(summary.end_time)
  return (
    <section className="rise rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: file identity */}
        <div className="min-w-0">
          {/* Breadcrumb-style label */}
          <p className="mb-1 text-xs text-zinc-600">
            {file.source === 'sample' ? 'sample log' : 'uploaded log'}
          </p>
          <h1 className="break-all font-mono text-lg font-semibold text-zinc-100">
            {file.file_name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>
              <span className="text-zinc-600">from</span> {formatLogTime(summary.start_time)}
              <span className="text-zinc-600"> to</span> {formatLogTime(summary.end_time)}
            </Chip>
            {start != null && end != null && (
              <Chip><span className="text-zinc-600">duration</span> {formatDuration(end - start)}</Chip>
            )}
            <Chip><span className="text-zinc-600">size</span> {formatBytes(file.size_bytes)}</Chip>
            <Chip><span className="text-zinc-600">analyzed</span> {formatUtc(file.uploaded_at)}</Chip>
          </div>
        </div>

        {/* Right: status + download */}
        <div className="flex flex-col items-end gap-2">
          <HealthPill incidents={incidents} />
          <ReportButton fileId={file.id} />
        </div>
      </div>
    </section>
  )
}
