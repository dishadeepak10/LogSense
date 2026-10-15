import { Link, useParams } from 'react-router-dom'

import { getIncident } from '../api/client'
import AnalysisCard from '../components/AnalysisCard'
import { CategoryTag, SeverityBadge } from '../components/Badges'
import LogEntries from '../components/LogEntries'
import ServiceTimeline from '../components/ServiceTimeline'
import SimilarIncidents from '../components/SimilarIncidents'
import { ErrorState, Loading } from '../components/States'
import { useApi } from '../hooks/useApi'
import { formatLogTime } from '../utils/format'

export default function IncidentDetailPage() {
  const { incidentId } = useParams()
  const { data: incident, loading, error, reload } = useApi(() => getIncident(incidentId), [incidentId])

  if (loading) return <Loading text="Loading incident..." />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/files/${incident.file_id}`} className="text-sm text-blue-700 hover:underline">
          ← {incident.file_name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={incident.severity} />
          <CategoryTag category={incident.category} />
          <span className="text-sm text-slate-500">Incident #{incident.id}</span>
        </div>
        <h1 className="mt-2 break-words text-xl font-bold sm:text-2xl">{incident.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {incident.error_count} errors from {formatLogTime(incident.start_time)} to{' '}
          {formatLogTime(incident.end_time)} · services: {incident.services.join(', ') || 'unknown'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AnalysisCard analysis={incident.analysis} />

          <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
            <h2 className="font-semibold">Failure timeline</h2>
            <p className="mb-4 text-sm text-slate-500">When each service logged its first error.</p>
            <ServiceTimeline rows={incident.service_timeline} startTime={incident.start_time} endTime={incident.end_time} />
          </section>
        </div>

        <div className="space-y-6">
          <SimilarIncidents items={incident.similar_incidents} />
          <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
            <h2 className="font-semibold">Candidate trigger</h2>
            <p className="mt-1 text-xs text-slate-500">Earliest related line (line {incident.candidate_trigger_line ?? '-'})</p>
            <p className="mt-2 break-words rounded bg-slate-50 p-2 font-mono text-xs text-slate-800">
              {incident.candidate_trigger || '-'}
            </p>
          </section>
        </div>
      </div>

      <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 font-semibold">Log lines in this incident</h2>
        <LogEntries entries={incident.entries} total={incident.total_entries} triggerLine={incident.candidate_trigger_line} />
      </section>
    </div>
  )
}
