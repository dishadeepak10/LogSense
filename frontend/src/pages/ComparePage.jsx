import { useEffect, useMemo, useState } from 'react'

import { getLogFile, listLogFiles } from '../api/client'
import { CategoryTag, SeverityBadge } from '../components/Badges'
import { EmptyState, ErrorState, Loading } from '../components/States'
import { useApi } from '../hooks/useApi'
import { formatBytes, formatUtc, SEVERITY_ORDER, SEVERITY_STYLES } from '../utils/format'

// ── helpers ────────────────────────────────────────────────────────────────

function worstSeverity(incidents) {
  if (!incidents?.length) return null
  for (const sev of SEVERITY_ORDER) {
    if (incidents.some((i) => i.severity === sev)) return sev
  }
  return null
}

function HealthPill({ incidents }) {
  const sev = worstSeverity(incidents)
  if (!sev)
    return (
      <span className="inline-flex rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-800">
        Healthy
      </span>
    )
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${SEVERITY_STYLES[sev]}`}
    >
      {incidents.length} incident{incidents.length !== 1 ? 's' : ''} · worst: {sev}
    </span>
  )
}

function StatCell({ label, value, highlight }) {
  return (
    <div className="rounded-lg bg-zinc-800/60 px-3 py-2 text-center">
      <div
        className={`text-lg font-bold tabular-nums ${
          highlight === 'worse'
            ? 'text-red-400'
            : highlight === 'better'
              ? 'text-emerald-400'
              : 'text-white'
        }`}
      >
        {value ?? '—'}
      </div>
      <div className="mt-0.5 text-xs text-zinc-400">{label}</div>
    </div>
  )
}

/** Returns 'worse' | 'better' | null for the side with the given value compared to the other. */
function highlightSide(valA, valB, side) {
  if (valA == null || valB == null || valA === valB) return null
  const isA = side === 'a'
  if (isA) return valA > valB ? 'worse' : 'better'
  return valB > valA ? 'worse' : 'better'
}

function IncidentRow({ incident, status }) {
  // status: 'shared' | 'new' | 'gone'
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg bg-zinc-800/40 px-3 py-2.5 ring-1 ring-white/5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{incident.title}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <SeverityBadge severity={incident.severity} />
          {incident.category && <CategoryTag category={incident.category} />}
          <span className="text-xs text-zinc-400">{incident.error_count} errors</span>
        </div>
      </div>
      {status === 'new' && (
        <span className="shrink-0 rounded-full bg-amber-950 px-2 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-800">
          New
        </span>
      )}
      {status === 'gone' && (
        <span className="shrink-0 rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-300 ring-1 ring-zinc-600">
          Gone
        </span>
      )}
    </div>
  )
}

/** Categorise incidents from A and B by title match. */
function classifyIncidents(incidentsA, incidentsB) {
  const titlesA = new Set((incidentsA || []).map((i) => i.title))
  const titlesB = new Set((incidentsB || []).map((i) => i.title))

  const statusA = (incidentsA || []).map((i) => ({
    incident: i,
    // 'gone' from B's perspective means A has it but B doesn't
    status: titlesB.has(i.title) ? 'shared' : 'gone',
  }))
  const statusB = (incidentsB || []).map((i) => ({
    incident: i,
    status: titlesA.has(i.title) ? 'shared' : 'new',
  }))

  return { statusA, statusB }
}

/** Summary diff banner between two files. */
function DiffBanner({ dataA, dataB, _nameA, nameB }) {
  const incA = dataA?.incidents?.length ?? 0
  const incB = dataB?.incidents?.length ?? 0
  const diff = incB - incA

  const { statusB } = classifyIncidents(dataA?.incidents, dataB?.incidents)
  const newCritical = statusB.filter(
    (s) => s.status === 'new' && s.incident.severity === 'critical',
  ).length
  const newHigh = statusB.filter(
    (s) => s.status === 'new' && s.incident.severity === 'high',
  ).length

  if (diff === 0 && newCritical === 0 && newHigh === 0) {
    return (
      <div className="rounded-lg bg-zinc-800/60 px-4 py-3 text-sm text-zinc-300 ring-1 ring-white/10">
        Files have the same number of incidents.
      </div>
    )
  }

  const worse = diff > 0
  const details = []
  if (newCritical) details.push(`${newCritical} new critical`)
  if (newHigh) details.push(`${newHigh} new high`)

  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm font-medium ring-1 ${
        worse
          ? 'bg-red-950/50 text-red-300 ring-red-800'
          : 'bg-emerald-950/50 text-emerald-300 ring-emerald-800'
      }`}
    >
      {worse ? '⚠ ' : '✓ '}
      <strong>{nameB}</strong>{' '}
      {diff > 0 ? `has ${diff} more incident${diff !== 1 ? 's' : ''}` : `has ${-diff} fewer incident${-diff !== 1 ? 's' : ''}`}
      {details.length > 0 && ` (${details.join(', ')})`}.
    </div>
  )
}

// ── file column ─────────────────────────────────────────────────────────────

function FileColumn({ data, side, otherData, label }) {
  const summary = data?.summary
  const incidents = data?.incidents || []
  const otherSummary = otherData?.summary
  const otherIncidents = otherData?.incidents || []

  const { statusA, statusB } = useMemo(
    () => classifyIncidents(side === 'a' ? incidents : otherIncidents, side === 'a' ? otherIncidents : incidents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, otherData],
  )

  const incidentStatuses = side === 'a' ? statusA : statusB

  const errA = side === 'a' ? summary?.error_count : otherSummary?.error_count
  const errB = side === 'a' ? otherSummary?.error_count : summary?.error_count
  const warnA = side === 'a' ? summary?.warning_count : otherSummary?.warning_count
  const warnB = side === 'a' ? otherSummary?.warning_count : summary?.warning_count
  const incA = side === 'a' ? incidents.length : otherIncidents.length
  const incB = side === 'a' ? otherIncidents.length : incidents.length

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {/* header */}
      <div className="rounded-xl bg-zinc-800/50 p-4 ring-1 ring-white/8">
        <p className="mb-1 text-xs font-medium text-zinc-400">{label}</p>
        <h2 className="truncate text-base font-semibold text-white">
          {data?.file?.file_name ?? '—'}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <HealthPill incidents={incidents} />
          <span className="text-xs text-zinc-500">{formatUtc(data?.file?.uploaded_at)}</span>
          {data?.file?.size_bytes != null && (
            <span className="text-xs text-zinc-500">{formatBytes(data.file.size_bytes)}</span>
          )}
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCell label="Lines" value={summary?.total_lines} />
        <StatCell
          label="Errors"
          value={summary?.error_count}
          highlight={highlightSide(errA, errB, side)}
        />
        <StatCell
          label="Warnings"
          value={summary?.warning_count}
          highlight={highlightSide(warnA, warnB, side)}
        />
        <StatCell
          label="Incidents"
          value={incidents.length}
          highlight={highlightSide(incA, incB, side)}
        />
      </div>

      {/* incidents */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Incidents
        </h3>
        {incidentStatuses.length === 0 ? (
          <EmptyState title="No incidents" />
        ) : (
          <div className="flex flex-col gap-2">
            {incidentStatuses.map(({ incident, status }) => (
              <IncidentRow key={incident.id ?? incident.title} incident={incident} status={status} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── page ────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { data: files, loading: filesLoading, error: filesError, reload } = useApi(listLogFiles, [])

  // Default to the two most recent (list is sorted newest-first from the API)
  const [idA, setIdA] = useState(null)
  const [idB, setIdB] = useState(null)

  // Set defaults once files load
  useEffect(() => {
    if (!files?.length) return
    if (idA === null) setIdA(String(files[0]?.id ?? ''))
    if (idB === null) setIdB(String(files[1]?.id ?? files[0]?.id ?? ''))
  }, [files]) // eslint-disable-line react-hooks/exhaustive-deps

  // Individual file data — each fetched separately whenever the selection changes
  const [dataA, setDataA] = useState(null)
  const [loadingA, setLoadingA] = useState(false)
  const [errorA, setErrorA] = useState(null)

  const [dataB, setDataB] = useState(null)
  const [loadingB, setLoadingB] = useState(false)
  const [errorB, setErrorB] = useState(null)

  useEffect(() => {
    if (!idA) return
    setLoadingA(true)
    setErrorA(null)
    getLogFile(idA)
      .then((d) => { setDataA(d); setLoadingA(false) })
      .catch((e) => { setErrorA(e?.message || 'Failed to load'); setLoadingA(false) })
  }, [idA])

  useEffect(() => {
    if (!idB) return
    setLoadingB(true)
    setErrorB(null)
    getLogFile(idB)
      .then((d) => { setDataB(d); setLoadingB(false) })
      .catch((e) => { setErrorB(e?.message || 'Failed to load'); setLoadingB(false) })
  }, [idB])

  const nameA = dataA?.file?.file_name ?? `File ${idA}`
  const nameB = dataB?.file?.file_name ?? `File ${idB}`

  const bothLoaded = dataA && dataB && !loadingA && !loadingB

  if (filesLoading) return <Loading text="Loading file list…" />
  if (filesError)
    return <ErrorState message={filesError} onRetry={reload} />
  if (!files?.length)
    return (
      <EmptyState title="No analyzed files yet">
        Upload and analyze a log file first, then come back to compare.
      </EmptyState>
    )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Compare Files</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Pick two analyzed log files to compare them side by side.
        </p>
      </div>

      {/* selectors */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <FileSelector
          label="File A"
          value={idA ?? ''}
          onChange={setIdA}
          files={files}
          excludeId={idB}
        />
        <FileSelector
          label="File B"
          value={idB ?? ''}
          onChange={setIdB}
          files={files}
          excludeId={idA}
        />
      </div>

      {/* diff banner */}
      {bothLoaded && (
        <DiffBanner dataA={dataA} dataB={dataB} nameA={nameA} nameB={nameB} />
      )}

      {/* columns */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* column A */}
        <div className="min-w-0 flex-1">
          {loadingA ? (
            <Loading text="Loading File A…" />
          ) : errorA ? (
            <ErrorState message={errorA} />
          ) : dataA ? (
            <FileColumn data={dataA} side="a" otherData={dataB} label="File A" />
          ) : null}
        </div>

        {/* divider */}
        <div className="hidden w-px self-stretch bg-zinc-700/60 lg:block" />
        <div className="block h-px w-full bg-zinc-700/60 lg:hidden" />

        {/* column B */}
        <div className="min-w-0 flex-1">
          {loadingB ? (
            <Loading text="Loading File B…" />
          ) : errorB ? (
            <ErrorState message={errorB} />
          ) : dataB ? (
            <FileColumn data={dataB} side="b" otherData={dataA} label="File B" />
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── dropdown ────────────────────────────────────────────────────────────────

function FileSelector({ label, value, onChange, files, excludeId }) {
  const options = (files || []).filter((f) => String(f.id) !== excludeId)
  return (
    <div className="flex min-w-48 flex-1 flex-col gap-1">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {options.map((f) => (
          <option key={f.id} value={String(f.id)}>
            {f.file_name} ({f.incident_count} incident{f.incident_count !== 1 ? 's' : ''})
          </option>
        ))}
        {options.length === 0 && <option value="">No other files</option>}
      </select>
    </div>
  )
}
