import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  ALLOWED_EXTENSIONS, MAX_UPLOAD_MB, errorMessage, listSamples, loadSample, uploadLog,
} from '../api/client'
import { EmptyState, ErrorState, Loading } from '../components/States'
import { useApi } from '../hooks/useApi'
import { formatBytes } from '../utils/format'

// Check the file in the browser first, so obvious mistakes don't need a server round trip.
// The backend checks again (never trust only the browser).
function checkFile(file) {
  const name = file.name.toLowerCase()
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return `Only ${ALLOWED_EXTENSIONS.join(', ')} files are accepted.`
  }
  if (file.size === 0) return 'The file is empty.'
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `The file is larger than ${MAX_UPLOAD_MB} MB.`
  return null
}

export default function UploadPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(null) // null, "upload" or "sample"
  const [error, setError] = useState(null)
  const [sampleName, setSampleName] = useState('')
  const samples = useApi(listSamples, [])

  function pickFile(picked) {
    if (!picked) return
    setError(checkFile(picked))
    setFile(picked)
  }

  // Both buttons end the same way: open the dashboard of the analyzed file.
  async function run(kind, action) {
    setBusy(kind)
    setError(null)
    setProgress(0)
    try {
      const result = await action()
      navigate(`/files/${result.file.id}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(null)
    }
  }

  const uploadDisabled = !file || Boolean(checkFile(file)) || busy !== null
  const selectedSample = sampleName || samples.data?.[0]?.name || ''

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h1 className="text-2xl font-bold">Analyze a log file</h1>
        <p className="mt-1 text-slate-400">
          Upload an application log. LogSense finds incidents, shows how the failure spread, and explains the
          probable root cause.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            pickFile(e.dataTransfer.files[0])
          }}
          className={`mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${
            dragging ? 'border-blue-500 bg-blue-950/50' : 'border-slate-700 bg-slate-900'
          }`}
        >
          <p className="font-medium text-slate-300">Drag a .log or .txt file here</p>
          <p className="my-2 text-sm text-slate-400">or</p>
          <button
            type="button"
            onClick={() => inputRef.current.click()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium ring-1 ring-slate-700 hover:bg-slate-800"
          >
            Choose file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            className="hidden"
            onChange={(e) => pickFile(e.target.files[0])}
          />
          <p className="mt-3 text-xs text-slate-400">Max {MAX_UPLOAD_MB} MB</p>
        </div>

        {file && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 p-4 ring-1 ring-slate-800">
            <div className="min-w-0">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-sm text-slate-400">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={() => run('upload', () => uploadLog(file, setProgress))}
              disabled={uploadDisabled}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {busy === 'upload' ? 'Analyzing...' : 'Upload and analyze'}
            </button>
          </div>
        )}

        {busy === 'upload' && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {progress < 100 ? `Uploading... ${progress}%` : 'Uploaded. Finding incidents and asking for root causes...'}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <ErrorState message={error} />
          </div>
        )}
      </section>

      <aside className="rounded-xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <h2 className="font-semibold">No log at hand?</h2>
        <p className="mt-1 text-sm text-slate-400">Try one of the sample logs with a known failure.</p>
        <div className="mt-4">
          {samples.loading && <Loading text="Loading samples..." />}
          {samples.error && <ErrorState message={samples.error} onRetry={samples.reload} />}
          {samples.data && samples.data.length === 0 && <EmptyState title="No sample logs on the server" />}
          {samples.data && samples.data.length > 0 && (
            <>
              <label htmlFor="sample" className="text-sm font-medium text-slate-300">
                Sample
              </label>
              <select
                id="sample"
                value={selectedSample}
                onChange={(e) => setSampleName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              >
                {samples.data.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({formatBytes(s.size_bytes)})
                  </option>
                ))}
              </select>
              <button
                onClick={() => run('sample', () => loadSample(selectedSample))}
                disabled={busy !== null}
                className="mt-3 w-full rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:bg-slate-700"
              >
                {busy === 'sample' ? 'Analyzing sample...' : 'Load sample log'}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
