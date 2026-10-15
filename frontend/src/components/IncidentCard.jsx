import { Link } from 'react-router-dom'

import { formatClock, formatLogTime } from '../utils/format'
import { CategoryTag, ConfidenceBadge, SeverityBadge } from './Badges'

// Colored stripe on the left edge, by severity
const STRIPES = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-500',
}

// One incident in a list. The whole card links to the incident details page.
export default function IncidentCard({ incident, delay = 0 }) {
  return (
    <Link
      to={`/incidents/${incident.id}`}
      className="card-link rise group relative block overflow-hidden p-4 pl-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${STRIPES[incident.severity] || STRIPES.low}`} />
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <CategoryTag category={incident.category} />
        {incident.analysis && <ConfidenceBadge confidence={incident.analysis.confidence} />}
        {incident.similar_incidents.length > 0 && (
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300 ring-1 ring-violet-500/30">
            Seen before
          </span>
        )}
        <span className="ml-auto text-slate-500 transition group-hover:translate-x-1 group-hover:text-blue-400" aria-hidden="true">
          →
        </span>
      </div>
      <p className="mt-2 break-words font-medium text-slate-100">{incident.title}</p>
      <p className="mt-1 text-sm text-slate-400">
        {incident.error_count} errors · {formatLogTime(incident.start_time)} to {formatClock(incident.end_time)} ·{' '}
        {incident.services.join(', ') || 'unknown service'}
      </p>
      {incident.analysis && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-300">
          <span className="font-medium">Probable root cause: </span>
          {incident.analysis.root_cause}
        </p>
      )}
    </Link>
  )
}
