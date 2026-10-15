// Color themes (palettes.js). Each palette is a set of CSS variables (see "@theme" in index.css).
// Tailwind classes like `text-accent-soft` or `bg-panel` read these variables,
// so changing the variables recolors the whole app instantly, without reloading.

export const PALETTES = {
  green: {
    name: 'Terminal Green',
    accent1: '#10b981', // emerald
    accent2: '#14b8a6', // teal
    accentSoft: '#6ee7b7', // lighter, for links and small text
    dot: '#a3e635', // lime: the anomaly dot in the logo
    btn1: '#059669',
    btn2: '#0d9488',
    btnText: '#ffffff',
    base: '#09090b', // page background
    panel: '#18181b', // cards
    glow1: 'rgb(16 185 129 / 0.12)',
    glow2: 'rgb(20 184 166 / 0.08)',
  },
  violet: {
    name: 'Neon Violet-Pink',
    accent1: '#a855f7',
    accent2: '#ec4899',
    accentSoft: '#d8b4fe',
    dot: '#22d3ee',
    btn1: '#9333ea',
    btn2: '#db2777',
    btnText: '#ffffff',
    base: '#0c0a14',
    panel: '#171325',
    glow1: 'rgb(168 85 247 / 0.14)',
    glow2: 'rgb(236 72 153 / 0.10)',
  },
  coral: {
    name: 'Sunset Coral',
    accent1: '#fb7185',
    accent2: '#fb923c',
    accentSoft: '#fda4af',
    dot: '#fde047',
    btn1: '#fb7185',
    btn2: '#fb923c',
    btnText: '#1c1917', // dark text: white is hard to read on these light colors
    base: '#0c0a09',
    panel: '#1c1917',
    glow1: 'rgb(251 113 133 / 0.12)',
    glow2: 'rgb(251 146 60 / 0.08)',
  },
}

export const DEFAULT_PALETTE = 'green'
export const STORAGE_KEY = 'logsense-palette'

// The browser tab icon in the current colors.
function faviconSvg(p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.btn1}"/><stop offset="1" stop-color="${p.btn2}"/></linearGradient></defs><rect width="40" height="40" rx="10" fill="url(#g)"/><g stroke="#fff" stroke-opacity="0.28" stroke-width="2" stroke-linecap="round"><line x1="8" y1="9.5" x2="26" y2="9.5"/><line x1="8" y1="30.5" x2="22" y2="30.5"/></g><polyline points="5,21 12,21 15,15 19,28 24,11 27.5,21 35,21" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="11" r="3" fill="${p.dot}" stroke="#111" stroke-width="1"/></svg>`
}

// Writes a palette's colors into CSS variables on <html>, and updates the tab icon.
export function applyPalette(key) {
  const p = PALETTES[key] || PALETTES[DEFAULT_PALETTE]
  const vars = {
    '--accent-1': p.accent1, '--accent-2': p.accent2, '--accent-soft': p.accentSoft, '--accent-dot': p.dot,
    '--btn-1': p.btn1, '--btn-2': p.btn2, '--btn-text': p.btnText,
    '--surface-base': p.base, '--surface-panel': p.panel, '--glow-1': p.glow1, '--glow-2': p.glow2,
  }
  for (const [name, value] of Object.entries(vars)) document.documentElement.style.setProperty(name, value)
  const icon = document.querySelector('link[rel="icon"]')
  if (icon) icon.href = `data:image/svg+xml,${encodeURIComponent(faviconSvg(p))}`
}

// localStorage can be missing or blocked (private windows), so every access is wrapped.
export function savedPalette() {
  try {
    const key = localStorage.getItem(STORAGE_KEY)
    return PALETTES[key] ? key : DEFAULT_PALETTE
  } catch {
    return DEFAULT_PALETTE
  }
}
