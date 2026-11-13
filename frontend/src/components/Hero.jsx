import { LogoMark } from './Logo'

// Live demo log lines shown in the terminal preview
const DEMO_LINES = [
  { time: '09:20:14', level: 'WARN',  service: 'db-proxy', text: 'Connection pool usage at 92% (46/50)' },
  { time: '09:20:32', level: 'WARN',  service: 'payment',  text: 'Slow query took 4200 ms' },
  { time: '09:20:50', level: 'ERROR', service: 'payment',  text: 'Could not get JDBC connection: pool exhausted' },
  { time: '09:20:57', level: 'ERROR', service: 'orders',   text: 'Failed to save order: db connection timed out' },
  { time: '09:21:18', level: 'ERROR', service: 'gateway',  text: 'Upstream payment returned 503 in 30964ms' },
  { time: '09:21:35', level: 'ERROR', service: 'payment',  text: 'Timeout waiting for connection from pool' },
]

const LEVEL_TEXT = { WARN: 'text-amber-400', ERROR: 'text-red-400' }

const FEATURES = [
  { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Anomaly detection', desc: 'Finds error spikes, bursts, and first-time errors automatically.' },
  { icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', label: 'Root cause', desc: 'LLM-powered probable cause, why it happened, and what to do.' },
  { icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', label: 'Failure spread', desc: 'Service timeline shows which broke first and how it cascaded.' },
  { icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4', label: 'Historical match', desc: 'Finds similar incidents across all previously analyzed logs.' },
]

function DemoTerminal() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg">
      {/* Title bar */}
      <div className="flex items-center gap-1.5 border-b border-zinc-800 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <span className="ml-3 font-mono text-xs text-zinc-500">payment_service.log</span>
        <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-widest text-zinc-500">demo</span>
      </div>

      {/* Log lines */}
      <div className="relative space-y-0.5 p-3 font-mono text-xs">
        <div className="hero-scan pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="h-10 bg-linear-to-b from-transparent via-accent-1/8 to-transparent" />
        </div>
        {DEMO_LINES.map((line, i) => (
          <div
            key={line.time}
            className={`rise flex gap-2 rounded px-1 py-0.5 ${line.level === 'ERROR' ? 'bg-red-950/50' : ''}`}
            style={{ animationDelay: `${200 + i * 200}ms` }}
          >
            <span className="shrink-0 text-zinc-600">{line.time}</span>
            <span className={`w-10 shrink-0 font-mono font-semibold ${LEVEL_TEXT[line.level]}`}>{line.level}</span>
            <span className="min-w-0 text-zinc-400">
              <span className="text-zinc-600">[{line.service}]</span>{' '}
              <span className="text-zinc-300">{line.text}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Result banner */}
      <div
        className="rise mx-3 mb-3 rounded border border-accent-1/25 bg-accent-1/8 p-3"
        style={{ animationDelay: '1600ms' }}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-accent-soft">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-1" />
            1 incident detected
          </span>
          <span className="rounded bg-orange-950 px-1.5 py-0.5 font-medium uppercase text-orange-300 ring-1 ring-orange-900">HIGH</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">Database</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-200">Root cause:</span>{' '}
          DB connection pool exhausted after slow query on <code className="text-accent-soft">payments</code>.
          order-service and gateway failures are knock-on effects.
        </p>
      </div>
    </div>
  )
}

export default function Hero({ onTrySample, sampleBusy, canTrySample }) {
  function scrollToUpload() {
    document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="border-b border-zinc-800/60 pb-8 pt-6">
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Left: headline + actions */}
        <div>
          {/* Pill badge */}
          <span className="rise inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-xs font-medium text-zinc-400">
            <LogoMark size={14} />
            Log anomaly detection &amp; root cause analysis
          </span>

          <h1 className="rise mt-4 text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl" style={{ animationDelay: '60ms' }}>
            Find incidents in your logs.{' '}
            <span className="text-accent-soft">Instantly.</span>
          </h1>

          <p className="rise mt-3 text-sm leading-relaxed text-zinc-400" style={{ animationDelay: '130ms' }}>
            Upload any <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300">.log</code> or{' '}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300">.txt</code> file.
            LogSense parses it, groups anomalies into incidents, maps the failure cascade across services,
            and returns a probable root cause — no config needed.
          </p>

          <div className="rise mt-5 flex flex-wrap gap-2" style={{ animationDelay: '200ms' }}>
            <button onClick={scrollToUpload} className="btn-primary px-5 py-2 text-sm">
              Upload a log
            </button>
            <button
              onClick={onTrySample}
              disabled={!canTrySample || sampleBusy}
              className="btn-secondary px-5 py-2 text-sm"
            >
              {sampleBusy ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Analyzing…
                </span>
              ) : (
                'Try a sample log →'
              )}
            </button>
          </div>

          <p className="rise mt-3 text-xs text-zinc-600" style={{ animationDelay: '270ms' }}>
            Supports .log and .txt · up to 100 MB · works without an AI key
          </p>
        </div>

        {/* Right: terminal demo */}
        <DemoTerminal />
      </div>

      {/* Feature grid — compact, more utilitarian */}
      <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <div
            key={f.label}
            className="rise flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
            style={{ animationDelay: `${350 + i * 60}ms` }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"
              className="mt-0.5 h-4 w-4 shrink-0 text-accent-1" aria-hidden="true">
              <path d={f.icon} />
            </svg>
            <div>
              <p className="text-sm font-medium text-zinc-200">{f.label}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
