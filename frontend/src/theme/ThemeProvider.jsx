import { useState } from 'react'

import { ThemeContext } from './context'
import { PALETTES, STORAGE_KEY, applyPalette, savedPalette } from './palettes'

// Wrap the app in this; any component can then call useTheme().
export default function ThemeProvider({ children }) {
  const [key, setKey] = useState(savedPalette)

  function choose(newKey) {
    applyPalette(newKey)
    setKey(newKey)
    try {
      localStorage.setItem(STORAGE_KEY, newKey)
    } catch {
      // not saved; the theme still works for this visit
    }
  }

  return <ThemeContext.Provider value={{ key, palette: PALETTES[key], choose }}>{children}</ThemeContext.Provider>
}
