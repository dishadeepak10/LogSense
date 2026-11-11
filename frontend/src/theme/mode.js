// Dark / light mode. The colors themselves live in index.css; this file only
// sets data-mode="light" or "dark" on <html> and remembers the choice.

const STORAGE_KEY = 'logsense-mode'

// First visit: follow the computer's setting. Later visits: what the user picked.
// localStorage can be missing or blocked (private windows), so it is wrapped in try/catch.
export function savedMode() {
  try {
    const mode = localStorage.getItem(STORAGE_KEY)
    if (mode === 'light' || mode === 'dark') return mode
  } catch {
    // fall through to the system setting
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyMode(mode) {
  document.documentElement.dataset.mode = mode
}

export function saveMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // not saved; the mode still works for this visit
  }
}
