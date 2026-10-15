import { LogoMark } from './Logo'

// The example shown in the hero's terminal. It is an illustration (marked "Example"),
// based on the payment_service_demo.log sample.
const DEMO_LINES = [
  { time: '09:20:14', level: 'WARN', service: 'db-proxy', text: 'Connection pool usage at 92% (46/50)' },
  { time: '09:20:32', level: 'WARN', service: 'payment', text: 'Slow query took 4200 ms' },
  { time: '09:20:50', level: 'ERROR', service: 'payment', text: 'Could not get JDBC connection: pool exhausted' },
  { time: '09:20:57', level: 'ERROR', service: 'orders', text: 'Failed to save order: database connection timed out' },
  { time: '09:21:18', level: 'ERROR', service: 'gateway', text: 'Upstream payment returned 503 in 30964ms' },
  { time: '09:21:35', level: 'ERROR', service: 'payment', text: 'Timeout waiting for connection from pool' },
]

const LEVEL_TEXT = { WARN: 'text-amber-400', ERROR: 'text-red-400' }

const FEATURES = [
  { title: 'Detects anomalies', text: 'Error spikes (median + MAD), bursts, and errors that never happened before.' },
  { title: 'Explains the cause', text: 'Probable root cause, why, and what to do, with or without an AI key.' },
  { title: 'Shows the spread', text: 'A timeline of which service broke first and how the failure moved.' },
  { title: 'Remembers', text: 'Spots incidents that look like ones from earlier log files.' },
]

// Little terminal window where the example lines appear one by one,
// the error lines light up, and the "LogSense found..." card pops in.
function DemoTerminal() {
  return (
    <div className="relative">
      {/* soft accent glow behind the window */}
      <div className="absolute -inset-4 rounded-3xl bg-linear-to-br from-accent-1/25 to-accent-2/10 blur-2xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950/90 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-amber-500/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
          <span className="ml-2 font-mono text-xs text-zinc-500">payment_service.log</span>
          <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-zinc-500">
            Example
          </span>
        </div>
        <div className="relative space-y-1 overflow-hidden p-4 font-mono text-xs sm:text-[0.8rem]">
          {/* a scan line that keeps moving down the window */}
          <div className="hero-scan pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="h-12 bg-linear-to-b from-transparent via-accent-1/10 to-transparent" />
          </div>
          {DEMO_LINES.map((line, i) => (
            <div
              key={line.time}
              className={`rise flex gap-2 rounded px-1.5 py-0.5 ${line.level === 'ERROR' ? 'bg-red-500/10 ring-1 ring-red-500/20' : ''}`}
              style={{ animationDelay: `${200 + i * 220}ms` }}
            >
              <span className="text-zinc-500">{line.time}</span>
              <span className={`w-11 shrink-0 font-semibold ${LEVEL_TEXT[line.level]}`}>{line.level}</span>
              <span className="min-w-0 truncate text-zinc-300">
                <span className="text-zinc-500">[{line.service}] </span>
                {line.text}
              </span>
            </div>
          ))}
        </div>
        {/* result card */}
        <div className="rise mx-4 mb-4 rounded-xl bg-panel p-4 ring-1 ring-accent-1/40" style={{ animationDelay: '1700ms' }}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-accent-soft">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-1" />
              LogSense found 1 incident
            </span>
            <span className="rounded-full bg-orange-950 px-2 py-0.5 font-semibold uppercase text-orange-300 ring-1 ring-orange-800">high</span>
            <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-300">Database</span>
          </div>
          <p className="mt-2 text-sm text-zinc-200">
            <span className="font-semibold">Probable root cause:</span> the payment database ran out of pooled
            connections after a slow query; orders and gateway errors followed.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Hero({ onTrySample, sampleBusy, canTrySample }) {
  function scrollToUpload() {
    document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="relative">
      <div className="grid items-center gap-10 py-6 lg:grid-cols-2 lg:py-12">
        <div>
          <span className="rise inline-flex items-center gap-2 rounded-full bg-accent-1/10 px-3 py-1 text-sm font-medium text-accent-soft ring-1 ring-accent-1/30">
            <LogoMark size={18} />
            Log anomaly detection + root cause
          </span>
          <h1 className="rise mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl" style={{ animationDelay: '80ms' }}>
            Your logs,{' '}
            <span className="bg-linear-to-r from-accent-1 to-accent-2 bg-clip-text text-transparent">made sense of.</span>
          </h1>
          <p className="rise mt-5 max-w-xl text-lg text-zinc-400" style={{ animationDelay: '160ms' }}>
            Drop in an application log. LogSense finds the incidents, shows which service broke first, and explains
            the probable root cause with a suggested fix.
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
            <button onClick={scrollToUpload} className="btn-primary px-6 py-3 text-base">
              Upload a log
            </button>
            <button
              onClick={onTrySample}
              disabled={!canTrySample || sampleBusy}
              className="btn-secondary px-6 py-3 text-base"
            >
              {sampleBusy ? 'Analyzing sample...' : 'Try a sample →'}
            </button>
          </div>
          <p className="rise mt-4 text-sm text-zinc-500" style={{ animationDelay: '320ms' }}>
            .log and .txt files up to 10 MB · works without an AI key
          </p>
        </div>
        <DemoTerminal />
      </div>

      <div className="grid gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, i) => (
          <div key={feature.title} className="card rise p-4" style={{ animationDelay: `${400 + i * 80}ms` }}>
            <p className="font-semibold text-zinc-100">{feature.title}</p>
            <p className="mt-1 text-sm text-zinc-400">{feature.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
