// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PracticeHub from './PracticeHub.jsx'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('./api.js', () => ({ apiFetch }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AI practice quiz', () => {
  it('requests and loads the selected number of generated questions', async () => {
    const questions = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      question_text: `AI-generated question ${index + 1}?`,
      options: { A: 'Choice A', B: 'Choice B', C: 'Choice C', D: 'Choice D' },
      correct_answer: 'A',
      explanation: 'Choice A is correct.',
    }))
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ questions }),
    })

    render(<PracticeHub />)
    fireEvent.change(screen.getByLabelText('Number of questions'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate AI quiz' }))

    expect(await screen.findByText('AI-generated question 1?')).toBeTruthy()
    expect(apiFetch).toHaveBeenCalledWith('/questions/generate_ai/', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Azure Cloud Concepts', count: 5 }),
    }))
    await waitFor(() => expect(screen.getByText('Question 1 of 5')).toBeTruthy())
  })
})
