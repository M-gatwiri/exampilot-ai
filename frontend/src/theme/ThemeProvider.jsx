import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { ThemeContext } from './ThemeContext.js'

const STORAGE_KEY = 'exampilot-theme'

function getSystemTheme() {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function subscribeToSystemTheme(onChange) {
  try {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return () => {}
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
  } catch {
    return () => {}
  }
}

function readStoredTheme() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

function persistTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // The current page still uses the selected theme if storage is unavailable.
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStoredTheme)
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => 'light')
  const theme = preference || systemTheme

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', theme === 'dark' ? '#09090b' : '#fafafa',
    )
  }, [theme])

  useEffect(() => {
    if (preference) persistTheme(preference)
  }, [preference])

  const toggleTheme = useCallback(() => {
    setPreference((current) => (current || systemTheme) === 'dark' ? 'light' : 'dark')
  }, [systemTheme])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
