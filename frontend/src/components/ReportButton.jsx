import { useState } from 'react'

import { downloadReport, errorMessage } from '../api/client'

export default function ReportButton({ fileId }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      await downloadReport(fileId)
    } catch (err) {
      setError(errorMessage(err))
    }
    setBusy(false)
  }

  return (
    <div className="text-right">
      <button
        onClick={download}
        disabled={busy}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium ring-1 ring-slate-700 hover:bg-slate-800 disabled:text-slate-600"
      >
        {busy ? 'Preparing...' : 'Download report (.md)'}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
