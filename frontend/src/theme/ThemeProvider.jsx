import { useState } from 'react'

import { ThemeContext } from './context'
import { applyMode, saveMode, savedMode } from './mode'

// Wrap the app in this; any component can then call useTheme().
export default function ThemeProvider({ children }) {
  const [mode, setMode] = useState(savedMode)

  function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark'
    applyMode(next)
    saveMode(next)
    setMode(next)
  }

  return <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>
}
