import { useState } from 'react'

import { LEVEL_STYLES, formatClock } from '../utils/format'

// The incident's log lines. Click a line to see the full raw text (stack traces included).
export default function LogEntries({ entries, total, triggerLine }) {
  const [open, setOpen] = useState(null)
  if (!entries.length) return <p className="text-sm text-slate-500">No log lines available.</p>

  return (
    <div>
      <ul className="divide-y divide-slate-100 font-mono text-xs">
        {entries.map((entry) => {
          const isOpen = open === entry.id
          const isTrigger = entry.line_number === triggerLine
          return (
            <li key={entry.id} className={isTrigger ? 'bg-blue-50' : ''}>
              <button
                onClick={() => setOpen(isOpen ? null : entry.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-slate-50"
              >
                <span className="w-10 shrink-0 text-right text-slate-400">{entry.line_number}</span>
                <span className="hidden w-16 shrink-0 text-slate-500 sm:block">{formatClock(entry.timestamp)}</span>
                <span className={`w-12 shrink-0 rounded px-1 text-center ${LEVEL_STYLES[entry.level] || ''}`}>
                  {entry.level || '-'}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {entry.service && <span className="text-slate-500">[{entry.service}] </span>}
                  {entry.message}
                  {isTrigger && <span className="ml-2 font-sans font-semibold text-blue-700">← candidate trigger</span>}
                </span>
              </button>
              {isOpen && (
                <pre className="mx-2 mb-2 overflow-x-auto whitespace-pre rounded bg-slate-900 p-3 text-slate-100">
                  {entry.raw}
                </pre>
              )}
            </li>
          )
        })}
      </ul>
      {total > entries.length && (
        <p className="mt-2 text-xs text-slate-500">Showing the first {entries.length} of {total} lines.</p>
      )}
    </div>
  )
}
