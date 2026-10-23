// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RevisionPlan from './RevisionPlan.jsx'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('./api.js', () => ({ apiFetch }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RevisionPlan', () => {
  it('loads recommendations and topic progress from saved quiz history', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        attempts: [],
        domains: [{ domain: 'Cloud Concepts', questions: 4, correct_answers: 2, score: 50 }],
        learning_insights: {
          attempts_analyzed: 2,
          status: 'ready',
          message: 'Start with Cloud Concepts.',
          recommendations: [{
            topic: 'Cloud Concepts',
            priority: 'high',
            accuracy: 50,
            questions: 4,
            correct_answers: 2,
            recommendation: 'Review Cloud Concepts and practice again.',
          }],
        },
      }),
    })
    const onPractice = vi.fn()

    render(<RevisionPlan onPractice={onPractice} />)

    expect(await screen.findByText('Review Cloud Concepts and practice again.')).toBeTruthy()
    expect(screen.getAllByText('Cloud Concepts').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
    expect(apiFetch).toHaveBeenCalledWith('/attempts/performance/', expect.objectContaining({ signal: expect.any(AbortSignal) }))

    fireEvent.click(screen.getByRole('button', { name: 'Practice this area' }))
    expect(onPractice).toHaveBeenCalledOnce()
  })
})
