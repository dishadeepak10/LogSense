import { Link } from 'react-router-dom'

import { formatClock, formatLogTime } from '../utils/format'
import { CategoryTag, ConfidenceBadge, SeverityBadge } from './Badges'

// One incident in a list. The whole card links to the incident details page.
export default function IncidentCard({ incident }) {
  return (
    <Link
      to={`/incidents/${incident.id}`}
      className="block rounded-lg bg-slate-900 p-4 ring-1 ring-slate-800 transition hover:ring-blue-500"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <CategoryTag category={incident.category} />
        {incident.analysis && <ConfidenceBadge confidence={incident.analysis.confidence} />}
        {incident.similar_incidents.length > 0 && (
          <span className="text-xs font-medium text-violet-400">Seen before</span>
        )}
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
