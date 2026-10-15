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
        className="btn-secondary text-sm"
      >
        {busy ? 'Preparing...' : 'Download report (.md)'}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
