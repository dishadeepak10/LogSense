import { Link, useParams } from 'react-router-dom'

import { getLogFile } from '../api/client'
import ErrorTimelineChart from '../components/ErrorTimelineChart'
import IncidentCard from '../components/IncidentCard'
import ReportButton from '../components/ReportButton'
import { EmptyState, ErrorState, Loading } from '../components/States'
import SummaryTiles from '../components/SummaryTiles'
import { useApi } from '../hooks/useApi'
import { formatLogTime, formatUtc } from '../utils/format'

const TOP_INCIDENTS = 3

export default function DashboardPage() {
  const { fileId } = useParams()
  const { data, loading, error, reload } = useApi(() => getLogFile(fileId), [fileId])

  if (loading) return <Loading text="Loading analysis..." />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const { file, summary, incidents } = data
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-all text-3xl font-bold tracking-tight">{file.file_name}</h1>
          <p className="text-sm text-slate-400">
            {file.source === 'sample' ? 'Sample log' : 'Uploaded'} {formatUtc(file.uploaded_at)} · log covers{' '}
            {formatLogTime(summary.start_time)} to {formatLogTime(summary.end_time)}
          </p>
        </div>
        <ReportButton fileId={file.id} />
      </div>

      <SummaryTiles summary={summary} />

      <section className="card p-4">
        <h2 className="mb-2 text-lg font-semibold">Errors and warnings over time</h2>
        <ErrorTimelineChart timeline={summary.error_timeline} bucketSeconds={summary.bucket_seconds} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Incidents ({incidents.length})</h2>
          {incidents.length > TOP_INCIDENTS && (
            <Link to={`/files/${file.id}/incidents`} className="text-sm font-medium text-blue-400 hover:underline">
              View all incidents →
            </Link>
          )}
        </div>
        {incidents.length === 0 ? (
          <EmptyState title="No incidents detected">
            No error spikes, bursts or new kinds of errors were found. The log looks healthy.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {incidents.slice(0, TOP_INCIDENTS).map((incident, i) => (
              <IncidentCard key={incident.id} incident={incident} delay={i * 80} />
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-2 text-lg font-semibold">Most frequent errors</h2>
        {summary.top_error_groups.length === 0 ? (
          <p className="text-sm text-slate-400">No ERROR or FATAL lines in this log.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 pr-3">Count</th>
                  <th className="pr-3">Level</th>
                  <th className="pr-3">Message pattern</th>
                  <th className="whitespace-nowrap">First seen</th>
                </tr>
              </thead>
              <tbody>
                {summary.top_error_groups.map((group) => (
                  <tr key={`${group.template}-${group.level}`} className="border-t border-slate-800 align-top">
                    <td className="py-1.5 pr-3 font-semibold tabular-nums">{group.count}</td>
                    <td className="pr-3">{group.level}</td>
                    <td className="break-all pr-3 font-mono text-xs" title={group.example}>{group.template}</td>
                    <td className="whitespace-nowrap text-slate-400">{formatLogTime(group.first_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
