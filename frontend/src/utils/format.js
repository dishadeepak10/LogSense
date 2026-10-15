// Small helpers for showing values. See "Conventions" in docs/API_CONTRACT.md.

// Times read from the log have no timezone: show them exactly as written.
// "2026-10-01T09:20:50.204000" -> "2026-10-01 09:20:50"
export function formatLogTime(value) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

// Only the clock part: "09:20:50"
export function formatClock(value) {
  if (!value) return '-'
  return formatLogTime(value).slice(11)
}

// Times we created (uploaded_at, created_at) are UTC with a "Z": show in the user's local time.
export function formatUtc(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

// Turn a log time into milliseconds so we can subtract two of them.
// We add "Z" only to make the browser read every log time the same way (no timezone shift).
export function logTimeMs(value) {
  if (!value) return null
  return Date.parse(value.slice(0, 23) + 'Z')
}

export function formatDuration(ms) {
  if (ms == null) return '-'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

export const SEVERITY_STYLES = {
  critical: 'bg-red-100 text-red-800 ring-red-300',
  high: 'bg-orange-100 text-orange-800 ring-orange-300',
  medium: 'bg-amber-100 text-amber-800 ring-amber-300',
  low: 'bg-slate-100 text-slate-700 ring-slate-300',
}

export const CATEGORY_LABELS = {
  database: 'Database',
  memory: 'Memory',
  disk: 'Disk',
  network: 'Network',
  auth: 'Authentication',
  config: 'Configuration',
  hardware: 'Hardware',
  application: 'Application',
}

export const LEVEL_STYLES = {
  FATAL: 'text-red-800 bg-red-100',
  ERROR: 'text-red-700 bg-red-50',
  WARN: 'text-amber-800 bg-amber-50',
  INFO: 'text-slate-700 bg-slate-100',
  DEBUG: 'text-slate-500 bg-slate-50',
}
