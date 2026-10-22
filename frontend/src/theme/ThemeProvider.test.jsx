// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeProvider.jsx'
import { useTheme } from './useTheme.js'

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <output>{theme}</output>
      <button type="button" onClick={toggleTheme}>Toggle theme</button>
    </div>
  )
}

function renderTheme() {
  return render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
}

function setSystemTheme(theme) {
  const listeners = new Set()
  const query = {
    matches: theme === 'dark',
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => query))
  return {
    set(nextTheme) {
      query.matches = nextTheme === 'dark'
      listeners.forEach((listener) => listener({ matches: query.matches }))
    },
  }
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.removeProperty('color-scheme')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('theme preference', () => {
  it('uses the operating system preference on a first visit and follows changes', () => {
    const system = setSystemTheme('dark')
    renderTheme()
    expect(screen.getByText('dark')).toBeTruthy()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('exampilot-theme')).toBeNull()

    act(() => system.set('light'))
    expect(screen.getByText('light')).toBeTruthy()
  })

  it('toggles, persists across a remount, and keeps an explicit choice over system changes', () => {
    const system = setSystemTheme('light')
    const view = renderTheme()
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(screen.getByText('dark')).toBeTruthy()
    expect(window.localStorage.getItem('exampilot-theme')).toBe('dark')

    act(() => system.set('light'))
    expect(screen.getByText('dark')).toBeTruthy()
    view.unmount()
    renderTheme()
    expect(screen.getByText('dark')).toBeTruthy()
  })

  it('keeps the theme usable if browser storage cannot be read or written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage disabled') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage disabled') })
    setSystemTheme('light')
    renderTheme()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(screen.getByText('dark')).toBeTruthy()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
