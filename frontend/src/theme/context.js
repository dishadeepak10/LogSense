import { createContext, useContext } from 'react'

// Shared mode state: { mode: "dark" | "light", toggle() }. Filled in by ThemeProvider.
export const ThemeContext = createContext(null)

// Any component can call useTheme() to read the mode or switch it.
export function useTheme() {
  return useContext(ThemeContext)
}
