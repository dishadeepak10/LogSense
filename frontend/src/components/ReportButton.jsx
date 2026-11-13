import { useState } from 'react'
import { downloadPdf, downloadReport, errorMessage } from '../api/client'

export default function ReportButton({ fileId }) {
  const [busy, setBusy] = useState(null) // null | 'md' | 'pdf'
  const [error, setError] = useState(null)

  async function download(kind, fn) {
    setBusy(kind)
    setError(null)
    try { await fn() } catch (err) { setError(errorMessage(err)) }
    setBusy(null)
  }

  return (
    <div className="text-right">
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => download('md', () => downloadReport(fileId))}
          disabled={busy !== null}
          className="btn-secondary text-sm"
        >
          {busy === 'md' ? 'Preparing...' : '↓ Markdown'}
        </button>
        <button
          onClick={() => download('pdf', () => downloadPdf(fileId))}
          disabled={busy !== null}
          className="btn-secondary text-sm"
        >
          {busy === 'pdf' ? 'Preparing...' : '↓ PDF'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
