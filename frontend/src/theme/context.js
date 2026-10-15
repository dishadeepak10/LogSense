import { createContext, useContext } from 'react'

// Shared theme state: { key, palette, choose }. Filled in by ThemeProvider.
export const ThemeContext = createContext(null)

// Any component can call useTheme() to read the current palette or switch it.
export function useTheme() {
  return useContext(ThemeContext)
}
