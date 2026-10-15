import { Link } from 'react-router-dom'

import { useAppeared } from '../hooks/useCountUp'

// "Seen before": earlier incidents with mostly the same error patterns (Jaccard similarity).
// The match bars grow from 0 to their value when the panel appears.
export default function SimilarIncidents({ items }) {
  const appeared = useAppeared()
  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold">Similar to earlier incidents</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">
          Nothing similar in earlier files. This looks like a new kind of problem.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => {
            const percent = Math.round(item.similarity * 100)
            return (
              <li key={item.incident_id}>
                <Link
                  to={`/incidents/${item.incident_id}`}
                  className="group block rounded-lg p-2 transition hover:bg-white/5"
                >
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-accent-soft group-hover:text-white">
                      Incident #{item.incident_id} in {item.file_name}
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-300">{percent}% match</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-accent-1 to-accent-2 transition-[width] duration-700 ease-out"
                      style={{ width: appeared ? `${percent}%` : '0%', transitionDelay: `${i * 100}ms` }}
                    />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-zinc-400">Match = share of error patterns the two incidents have in common.</p>
    </section>
  )
}
