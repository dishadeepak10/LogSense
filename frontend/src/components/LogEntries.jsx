import { useState } from 'react'

import { LEVEL_STYLES, formatClock } from '../utils/format'

// The incident's log lines. Click a line to see the full raw text (stack traces included).
export default function LogEntries({ entries, total, triggerLine }) {
  const [open, setOpen] = useState(null)
  if (!entries.length) return <p className="text-sm text-zinc-400">No log lines available.</p>

  return (
    <div>
      <ul className="divide-y divide-zinc-800 font-mono text-xs">
        {entries.map((entry) => {
          const isOpen = open === entry.id
          const isTrigger = entry.line_number === triggerLine
          return (
            <li key={entry.id} className={isTrigger ? 'bg-accent-1/10' : ''}>
              <button
                onClick={() => setOpen(isOpen ? null : entry.id)}
                aria-expanded={isOpen}
                className="group flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition hover:bg-white/5"
              >
                {/* arrow turns to point down when the line is open */}
                <span aria-hidden="true" className={`shrink-0 text-zinc-500 transition-transform group-hover:text-accent-soft ${isOpen ? 'rotate-90' : ''}`}>
                  ▸
                </span>
                <span className="w-10 shrink-0 text-right text-zinc-500">{entry.line_number}</span>
                <span className="hidden w-16 shrink-0 text-zinc-400 sm:block">{formatClock(entry.timestamp)}</span>
                <span className={`w-12 shrink-0 rounded px-1 text-center ${LEVEL_STYLES[entry.level] || ''}`}>
                  {entry.level || '-'}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {entry.service && <span className="text-zinc-400">[{entry.service}] </span>}
                  {entry.message}
                  {isTrigger && <span className="ml-2 font-sans font-semibold text-accent-soft">← candidate trigger</span>}
                </span>
              </button>
              {isOpen && (
                <pre className="rise mx-2 mb-2 overflow-x-auto whitespace-pre rounded bg-base p-3 text-zinc-200 ring-1 ring-zinc-800">
                  {entry.raw}
                </pre>
              )}
            </li>
          )
        })}
      </ul>
      {total > entries.length && (
        <p className="mt-2 text-xs text-zinc-400">Showing the first {entries.length} of {total} lines.</p>
      )}
    </div>
  )
}
