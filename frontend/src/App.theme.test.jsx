// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'

vi.mock('./auth/useAuth.js', () => ({
  useAuth: () => ({
    user: null,
    status: 'ready',
    isConfigured: false,
    authError: '',
    clearAuthError: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    profile: null,
    profileStatus: 'idle',
    profileError: '',
    retryProfileSync: vi.fn(),
  }),
}))

vi.mock('./PerformanceSummary.jsx', () => ({ default: () => null }))
vi.mock('./PerformanceDashboard.jsx', () => ({ default: () => <p>Performance dashboard</p> }))

const questions = [
  { id: 1, question_text: 'Which answer belongs to question one?', options: { A: 'Alpha', B: 'Beta' } },
  { id: 2, question_text: 'Which answer belongs to question two?', options: { A: 'Gamma', B: 'Delta' } },
]

beforeEach(() => {
  window.localStorage.clear()
  window.fetch = vi.fn(async (url) => {
    if (url === '/api/questions/') {
      return { ok: true, json: async () => questions }
    }
    if (url === '/api/attempts/submit_quiz/') {
      return {
        ok: true,
        json: async () => ({ score: 50, correct_answers: 1, total_questions: 2, question_results: [] }),
      }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('application theme control', () => {
  it('keeps quiz answers and progress when toggled, and submits normally afterward', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ThemeProvider><App /></ThemeProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Practice Hub' }))
    fireEvent.click(screen.getByRole('button', { name: /Start practice session/ }))
    await screen.findByText(questions[0].question_text)
    fireEvent.click(screen.getByRole('radio', { name: /Alpha/ }))
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }))
    await screen.findByText(questions[1].question_text)

    fireEvent.click(screen.getByRole('button', { name: /Switch to dark theme/ }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByText('Question 2 of 2')).toBeTruthy()
    expect(screen.getByText('1 answered')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Previous/ }))
    expect(screen.getByRole('radio', { name: /Alpha/ }).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Delta/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit quiz' }))

    await waitFor(() => expect(screen.getByText('Performance dashboard')).toBeTruthy())
    expect(window.fetch).toHaveBeenLastCalledWith('/api/attempts/submit_quiz/', expect.objectContaining({ method: 'POST' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
