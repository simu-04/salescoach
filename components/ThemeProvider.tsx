'use client'
/**
 * ThemeProvider — global dark/light mode manager.
 *
 * - Reads preference from localStorage on mount (no flash thanks to suppressHydrationWarning on <html>)
 * - Falls back to system preference (prefers-color-scheme)
 * - Writes data-theme="dark"|"light" to <html>
 * - Exposes useTheme() hook to any component
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme:  Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:  'dark',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start dark — real value applied in useEffect to avoid SSR mismatch
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('sc-theme') as Theme | null
    const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    const resolved = saved ?? system
    setTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('sc-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
