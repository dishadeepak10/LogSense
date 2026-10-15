import { useTheme } from '../theme/context'

// A sliding switch: moon on the left (dark), sun on the right (light).
export default function ModeToggle() {
  const { mode, toggle } = useTheme()
  const light = mode === 'light'
  return (
    <button
      role="switch"
      aria-checked={light}
      aria-label="Light mode"
      title={light ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={toggle}
      className="relative flex h-8 w-16 items-center rounded-full bg-zinc-800 ring-1 ring-white/10 transition hover:ring-accent-1/60 active:scale-95"
    >
      {/* the moving knob */}
      <span
        className={`absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-transform duration-300 ${
          light ? 'translate-x-8 bg-amber-400' : 'translate-x-0 bg-zinc-100'
        }`}
      >
        {light ? (
          // sun
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#78350f" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          // moon
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#18181b" aria-hidden="true">
            <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
          </svg>
        )}
      </span>
    </button>
  )
}
