import { useId, useState } from 'react'

// The LogSense mark: faint log lines with a "heartbeat" line through them.
// The amber dot sits on the spike, the anomaly that LogSense senses.
//
// Interactions (styles in index.css, section "Logo"):
//   hover  -> the heartbeat line draws itself again, the dot pops, the mark tilts and glows
//   click  -> a scan beam sweeps across the mark
//   looping -> used by the loading spinner: the line keeps drawing over and over
export function LogoMark({ size = 36, looping = false, scanKey = 0 }) {
  const id = useId() // unique ids, so two logos on one page don't share a gradient
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      className={`logo-mark ${looping ? 'logo-looping' : ''}`}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id={`${id}-scan`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect width="40" height="40" rx="10" />
        </clipPath>
      </defs>

      <rect width="40" height="40" rx="10" fill={`url(#${id}-bg)`} />
      {/* faint log lines */}
      <g stroke="#fff" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round">
        <line x1="8" y1="9.5" x2="26" y2="9.5" />
        <line x1="8" y1="30.5" x2="22" y2="30.5" />
      </g>
      {/* heartbeat line; pathLength=100 makes the draw animation easy (dash 100 = whole line) */}
      <polyline
        className="logo-pulse"
        pathLength="100"
        points="5,21 12,21 15,15 19,28 24,11 27.5,21 35,21"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the anomaly */}
      <circle className="logo-dot" cx="24" cy="11" r="3" fill="#fbbf24" stroke="#1e1b4b" strokeWidth="1" />
      {/* scan beam: re-mounted (new key) on every click so the sweep plays again */}
      {scanKey > 0 && (
        <g clipPath={`url(#${id}-clip)`}>
          <rect key={scanKey} className="logo-scan" x="-16" y="0" width="16" height="40" fill={`url(#${id}-scan)`} />
        </g>
      )}
    </svg>
  )
}

// Mark + name for the header. The tagline slides out on hover (wide screens only).
export default function Logo() {
  const [scanKey, setScanKey] = useState(0)
  return (
    <span className="logo group flex items-center gap-2.5" onClick={() => setScanKey((n) => n + 1)}>
      <LogoMark scanKey={scanKey} />
      <span className="text-xl font-bold tracking-tight">
        <span className="text-white">Log</span>
        <span className="bg-linear-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">Sense</span>
      </span>
      <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-sm text-slate-400 opacity-0 transition-all duration-500 group-hover:max-w-56 group-hover:opacity-100 md:inline">
        · logs, made sense of
      </span>
    </span>
  )
}
