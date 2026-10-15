import { Link } from 'react-router-dom'

// "Seen before": earlier incidents with mostly the same error patterns (Jaccard similarity).
export default function SimilarIncidents({ items }) {
  return (
    <section className="rounded-lg bg-slate-900 p-5 ring-1 ring-slate-800">
      <h2 className="font-semibold">Similar to earlier incidents</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">
          Nothing similar in earlier files. This looks like a new kind of problem.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => {
            const percent = Math.round(item.similarity * 100)
            return (
              <li key={item.incident_id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <Link to={`/incidents/${item.incident_id}`} className="min-w-0 truncate font-medium text-blue-400 hover:underline">
                    Incident #{item.incident_id} in {item.file_name}
                  </Link>
                  <span className="shrink-0 tabular-nums text-slate-300">{percent}% match</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-400">Match = share of error patterns the two incidents have in common.</p>
    </section>
  )
}
