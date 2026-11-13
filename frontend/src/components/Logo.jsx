import { useId, useState } from 'react'

// High-quality LogSense logo mark.
// Concept: a terminal window (rounded rect with title bar) + magnifier overlay.
// The magnifier's lens sits over the terminal lines, scanning for the anomaly.
export function LogoMark({ size = 36, looping = false, scanKey = 0 }) {
  const id = useId()
  return (
    <svg
      viewBox="0 0 44 44"
      width={size}
      height={size}
      aria-hidden="true"
      className={`logo-mark ${looping ? 'logo-looping' : ''}`}
    >
      <defs>
        {/* Main icon background — deep dark with slight blue undertone */}
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1e24" />
          <stop offset="100%" stopColor="#131317" />
        </linearGradient>

        {/* Green accent gradient for the prompt chevron */}
        <linearGradient id={`${id}-green`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        {/* Magnifier lens fill */}
        <radialGradient id={`${id}-lens`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#2a2a35" />
          <stop offset="100%" stopColor="#1a1a22" />
        </radialGradient>

        {/* Scan beam for click interaction */}
        <linearGradient id={`${id}-scan`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>

        {/* Drop shadow filter */}
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.5" />
        </filter>

        <clipPath id={`${id}-clip`}>
          <rect width="44" height="44" rx="10" />
        </clipPath>
      </defs>

      {/* ── Outer container ── */}
      {/* Subtle outer glow ring */}
      <rect x="0.5" y="0.5" width="43" height="43" rx="9.5" fill="none"
        stroke="#10b981" strokeOpacity="0.35" strokeWidth="1" />

      {/* Main background */}
      <rect width="44" height="44" rx="10" fill={`url(#${id}-bg)`} />

      {/* ── Terminal title bar ── */}
      <rect x="0" y="0" width="44" height="11" rx="10" fill="#202028" />
      <rect x="0" y="5" width="44" height="6" fill="#202028" />

      {/* Traffic lights */}
      <circle cx="8"  cy="5.5" r="2" fill="#ff5f57" opacity="0.9" />
      <circle cx="15" cy="5.5" r="2" fill="#febc2e" opacity="0.9" />
      <circle cx="22" cy="5.5" r="2" fill="#28c840" opacity="0.9" />

      {/* ── Log lines (the "document" being scanned) ── */}
      {/* Line 1 */}
      <rect x="6" y="15" width="20" height="1.5" rx="0.75" fill="#3f3f50" />
      <rect x="28" y="15" width="10" height="1.5" rx="0.75" fill="#2a2a38" />
      {/* Line 2 */}
      <rect x="6" y="19.5" width="14" height="1.5" rx="0.75" fill="#3f3f50" />
      <rect x="22" y="19.5" width="16" height="1.5" rx="0.75" fill="#2a2a38" />
      {/* Line 3 — highlighted (the error line) */}
      <rect x="6" y="24" width="30" height="1.5" rx="0.75" fill="#7f1d1d" opacity="0.7" />
      <rect x="6" y="24" width="10" height="1.5" rx="0.75" fill="#f87171" opacity="0.9" />
      {/* Line 4 */}
      <rect x="6" y="28.5" width="22" height="1.5" rx="0.75" fill="#3f3f50" />

      {/* ── Magnifier ── */}
      {/* Lens circle with gradient fill */}
      <circle cx="30" cy="29" r="9.5" fill={`url(#${id}-lens)`}
        stroke="#10b981" strokeWidth="1.6" filter={`url(#${id}-shadow)`} />

      {/* Inner lens highlight arc (top-left reflection) */}
      <path d="M 23.5 25.5 A 7 7 0 0 1 32 23"
        fill="none" stroke="#fff" strokeWidth="0.8" strokeOpacity="0.15"
        strokeLinecap="round" />

      {/* Magnifier handle */}
      <line x1="37" y1="36" x2="41.5" y2="40.5"
        stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"
        filter={`url(#${id}-shadow)`} />

      {/* Terminal chevron > inside the lens */}
      <polyline
        className="logo-pulse"
        pathLength="100"
        points="26.5,26.5 30,29 26.5,31.5"
        fill="none"
        stroke={`url(#${id}-green)`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Cursor bar after the chevron */}
      <rect x="31.5" y="28.1" width="5" height="1.8" rx="0.9"
        fill="#10b981" opacity="0.85" />

      {/* Anomaly dot on the lens rim */}
      <circle className="logo-dot" cx="37.5" cy="21.5" r="3"
        fill="var(--accent-dot)" stroke="#131317" strokeWidth="1" />

      {/* Scan beam on click */}
      {scanKey > 0 && (
        <g clipPath={`url(#${id}-clip)`}>
          <rect key={scanKey} className="logo-scan" x="-16" y="0"
            width="16" height="44" fill={`url(#${id}-scan)`} />
        </g>
      )}
    </svg>
  )
}

export default function Logo() {
  const [scanKey, setScanKey] = useState(0)
  return (
    <span className="logo group flex items-center gap-2.5" onClick={() => setScanKey((n) => n + 1)}>
      <LogoMark size={36} scanKey={scanKey} />
      <span className="text-[1.1rem] font-semibold tracking-tight text-zinc-100">
        Log<span className="text-accent-soft">Sense</span>
      </span>
    </span>
  )
}
