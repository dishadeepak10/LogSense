import { formatBytes, formatDuration, formatLogTime, formatUtc, logTimeMs, SEVERITY_ORDER, SEVERITY_STYLES } from '../utils/format'
import ReportButton from './ReportButton'

// Top banner of the dashboard: which file, what time it covers, and an overall health pill.

function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-white/10">
      {children}
    </span>
  )
}

// "Healthy" when there are no incidents, otherwise the worst severity decides the color.
function HealthPill({ incidents }) {
  if (incidents.length === 0) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-green-950 px-3 py-1.5 text-sm font-semibold text-green-300 ring-1 ring-green-800">
        <span aria-hidden="true">✓</span> Healthy · no incidents
      </span>
    )
  }
  const worst = SEVERITY_ORDER.find((s) => incidents.some((i) => i.severity === s)) || 'low'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${SEVERITY_STYLES[worst]}`}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      {incidents.length} incident{incidents.length === 1 ? '' : 's'} · worst: {worst}
    </span>
  )
}

export default function FileHeader({ file, summary, incidents }) {
  const start = logTimeMs(summary.start_time)
  const end = logTimeMs(summary.end_time)
  return (
    <section className="card rise relative overflow-hidden p-5 sm:p-6">
      {/* soft accent glow in the corner */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-1/15 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-accent-1 to-accent-2 font-mono text-sm font-bold text-white shadow-lg sm:flex">
            LOG
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-accent-soft">{file.source === 'sample' ? 'Sample log' : 'Uploaded log'}</p>
            <h1 className="break-all text-2xl font-bold tracking-tight sm:text-3xl">{file.file_name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip><span className="text-zinc-500">From</span> {formatLogTime(summary.start_time)} <span className="text-zinc-500">to</span> {formatLogTime(summary.end_time)}</Chip>
              {start != null && end != null && <Chip><span className="text-zinc-500">Covers</span> {formatDuration(end - start)}</Chip>}
              <Chip><span className="text-zinc-500">Size</span> {formatBytes(file.size_bytes)}</Chip>
              <Chip><span className="text-zinc-500">Analyzed</span> {formatUtc(file.uploaded_at)}</Chip>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <HealthPill incidents={incidents} />
          <ReportButton fileId={file.id} />
        </div>
      </div>
    </section>
  )
}
