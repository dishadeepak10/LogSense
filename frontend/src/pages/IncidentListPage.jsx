import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getLogFile } from '../api/client'
import IncidentCard from '../components/IncidentCard'
import { EmptyState, ErrorState, Loading } from '../components/States'
import { useApi } from '../hooks/useApi'
import { CATEGORY_LABELS, SEVERITY_ORDER } from '../utils/format'

// Every incident of one file, with simple filters. The list arrives already sorted most severe first.
export default function IncidentListPage() {
  const { fileId } = useParams()
  const { data, loading, error, reload } = useApi(() => getLogFile(fileId), [fileId])
  const [severity, setSeverity] = useState('all')
  const [category, setCategory] = useState('all')

  if (loading) return <Loading text="Loading incidents..." />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const { file, incidents } = data
  const categories = [...new Set(incidents.map((i) => i.category))]
  const shown = incidents.filter(
    (i) => (severity === 'all' || i.severity === severity) && (category === 'all' || i.category === category),
  )

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/files/${file.id}`} className="text-sm text-blue-400 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-1 break-all text-3xl font-bold tracking-tight">Incidents in {file.file_name}</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm transition hover:border-white/25" aria-label="Severity">
          <option value="all">All severities</option>
          {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm transition hover:border-white/25" aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
        <span className="self-center text-sm text-slate-400">
          Showing {shown.length} of {incidents.length}
        </span>
      </div>

      {incidents.length === 0 && <EmptyState title="No incidents detected">The log looks healthy.</EmptyState>}
      {incidents.length > 0 && shown.length === 0 && <EmptyState title="No incidents match these filters" />}
      <div className="space-y-3">
        {shown.map((incident, i) => <IncidentCard key={incident.id} incident={incident} delay={Math.min(i, 10) * 50} />)}
      </div>
    </div>
  )
}
