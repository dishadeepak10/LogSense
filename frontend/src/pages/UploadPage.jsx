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

// "inventory_db_outage.log" -> "Inventory db outage"
function prettyName(fileName) {
  const words = fileName.replace(/\.(log|txt)$/i, '').replace(/[_-]+/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
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
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Analyze a{' '}
          <span className="bg-linear-to-r from-accent-1 to-accent-2 bg-clip-text text-transparent">log file</span>
        </h1>
        <p className="mt-1 text-zinc-400">
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
          onClick={() => inputRef.current.click()}
          className={`group mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition duration-300 ${
            dragging
              ? 'glow scale-[1.02] border-accent-1 bg-accent-1/10'
              : 'border-zinc-700 bg-panel/60 hover:border-accent-1/60 hover:bg-panel'
          }`}
        >
          {/* upload icon: bounces while a file is dragged over */}
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"
            className={`mb-3 h-14 w-14 text-accent-soft transition group-hover:-translate-y-1 ${dragging ? 'animate-bounce' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          <p className="text-lg font-medium text-zinc-200">
            {dragging ? 'Drop it!' : 'Drag a .log or .txt file here'}
          </p>
          <p className="my-2 text-sm text-zinc-400">or</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation() // the whole box already opens the picker; don't open it twice
              inputRef.current.click()
            }}
            className="btn-secondary px-4"
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
          <p className="mt-3 text-xs text-zinc-400">Max {MAX_UPLOAD_MB} MB</p>
        </div>

        {file && (
          <div className="card rise mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-lg bg-accent-1/15 px-2 py-1 font-mono text-xs text-accent-soft ring-1 ring-accent-1/30">
                LOG
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-sm text-zinc-400">{formatBytes(file.size)}</p>
              </div>
            </div>
            <button
              onClick={() => run('upload', () => uploadLog(file, setProgress))}
              disabled={uploadDisabled}
              className="btn-primary"
            >
              {busy === 'upload' ? 'Analyzing...' : 'Upload and analyze'}
            </button>
          </div>
        )}

        {busy === 'upload' && (
          <div className="mt-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full bg-linear-to-r from-accent-1 to-accent-2 transition-all ${progress >= 100 ? 'animate-pulse' : ''}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-zinc-400">
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

      <aside className="card p-5">
        <h2 className="text-lg font-semibold">No log at hand?</h2>
        <p className="mt-1 text-sm text-zinc-400">Try one of the sample logs with a known failure.</p>
        <div className="mt-4">
          {samples.loading && <Loading text="Loading samples..." />}
          {samples.error && <ErrorState message={samples.error} onRetry={samples.reload} />}
          {samples.data && samples.data.length === 0 && <EmptyState title="No sample logs on the server" />}
          {samples.data && samples.data.length > 0 && (
            <>
              {/* Each sample is a button; the selected one is highlighted (works like radio buttons) */}
              <div role="radiogroup" aria-label="Sample log" className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {samples.data.map((s) => {
                  const selected = s.name === selectedSample
                  return (
                    <button
                      key={s.name}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSampleName(s.name)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        selected
                          ? 'bg-accent-1/15 text-white ring-1 ring-accent-1/60'
                          : 'text-zinc-300 ring-1 ring-white/5 hover:bg-white/5 hover:ring-white/15'
                      }`}
                    >
                      <span className="min-w-0 truncate">{prettyName(s.name)}</span>
                      <span className="shrink-0 text-xs text-zinc-500">{formatBytes(s.size_bytes)}</span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => run('sample', () => loadSample(selectedSample))}
                disabled={busy !== null}
                className="btn-primary mt-4 w-full"
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
