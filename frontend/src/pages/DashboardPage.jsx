import { Link, useParams } from 'react-router-dom'

import { getLogFile } from '../api/client'
import ErrorTimelineChart from '../components/ErrorTimelineChart'
import FileHeader from '../components/FileHeader'
import IncidentCard from '../components/IncidentCard'
import LevelMix from '../components/LevelMix'
import { ErrorState, Loading } from '../components/States'
import SummaryTiles from '../components/SummaryTiles'
import TopErrors from '../components/TopErrors'
import { useApi } from '../hooks/useApi'

const TOP_INCIDENTS = 3

function Panel({ title, action, className = '', delay = 0, children }) {
  return (
    <section className={`card rise flex flex-col p-5 ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  )
}

// Shown instead of the incident list when nothing was found.
function AllClear() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl bg-green-950/60 p-6 text-center ring-1 ring-green-800">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-900 text-2xl text-green-300">✓</span>
      <p className="mt-3 font-semibold text-green-300">All clear</p>
      <p className="mt-1 text-sm text-zinc-400">No error spikes, bursts or new kinds of errors. The log looks healthy.</p>
    </div>
  )
}

// Every service in the log; the ones involved in an incident get a red dot.
function Services({ services, incidents }) {
  const involved = new Set(incidents.flatMap((i) => i.services))
  if (services.length === 0) return <p className="text-sm text-zinc-400">No service names found in this log.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {services.map((service) => (
        <span key={service}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-white/10">
          {involved.has(service) && <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="Involved in an incident" />}
          {service}
        </span>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { fileId } = useParams()
  const { data, loading, error, reload } = useApi(() => getLogFile(fileId), [fileId])

  if (loading) return <Loading text="Loading analysis..." />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const { file, summary, incidents } = data
  return (
    <div className="space-y-6">
      <FileHeader file={file} summary={summary} incidents={incidents} />

      <SummaryTiles summary={summary} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Errors and warnings over time" className="lg:col-span-2" delay={150}>
          <ErrorTimelineChart timeline={summary.error_timeline} bucketSeconds={summary.bucket_seconds} incidents={incidents} />
        </Panel>

        <Panel
          title={`Incidents (${incidents.length})`}
          delay={220}
          action={incidents.length > TOP_INCIDENTS && (
            <Link to={`/files/${file.id}/incidents`} className="text-sm font-medium text-accent-soft hover:underline">
              View all →
            </Link>
          )}
        >
          {incidents.length === 0 ? (
            <AllClear />
          ) : (
            <div className="space-y-3">
              {incidents.slice(0, TOP_INCIDENTS).map((incident, i) => (
                <IncidentCard key={incident.id} incident={incident} delay={300 + i * 80} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel title="Most frequent errors" className="lg:col-span-2" delay={280}>
          <TopErrors groups={summary.top_error_groups} />
        </Panel>

        <div className="space-y-6">
          <Panel title="Log level mix" delay={340}>
            <LevelMix levelCounts={summary.level_counts} />
          </Panel>
          <Panel title={`Services (${summary.services.length})`} delay={400}>
            <Services services={summary.services} incidents={incidents} />
          </Panel>
        </div>
      </div>
    </div>
  )
}
