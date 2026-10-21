import { useEffect, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export default function PerformanceSummary({ onOpenPerformance, onPractice }) {
  const [performance, setPerformance] = useState(null)
  const [status, setStatus] = useState('loading')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadSummary() {
      setStatus('loading')
      try {
        const response = await fetch(`${API_BASE_URL}/attempts/performance/`, { signal: controller.signal })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Your performance summary could not be loaded.')
        setPerformance(data)
        setStatus('ready')
      } catch (error) {
        if (error.name !== 'AbortError') setStatus('error')
      }
    }
    loadSummary()
    return () => controller.abort()
  }, [retryCount])

  const attempts = performance?.attempts || []
  const average = attempts.length
    ? Math.round(attempts.reduce((total, attempt) => total + attempt.score, 0) / attempts.length)
    : null

  return (
    <section className="dashboard-performance" aria-labelledby="dashboard-performance-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">YOUR RESULTS</p>
          <h2 id="dashboard-performance-title">Performance at a glance</h2>
        </div>
        <button className="text-button" onClick={onOpenPerformance}>View full performance <span aria-hidden="true">→</span></button>
      </div>
      {status === 'loading' && <p className="performance-muted" role="status">Loading your quiz history…</p>}
      {status === 'error' && (
        <div className="performance-error" role="alert">
          <p>Could not load your quiz history. Check your connection and try again.</p>
          <button className="quiz-secondary-button" onClick={() => setRetryCount((count) => count + 1)}>Retry</button>
        </div>
      )}
      {status === 'ready' && attempts.length === 0 && (
        <div className="dashboard-summary-empty">
          <p>No completed quizzes yet. Take a practice quiz to start tracking your progress.</p>
          <button className="quiz-primary-button" onClick={onPractice}>Start practicing</button>
        </div>
      )}
      {status === 'ready' && attempts.length > 0 && (
        <>
          <div className="summary-metrics">
            <article><span>Completed quizzes</span><strong>{attempts.length}</strong></article>
            <article><span>Average score</span><strong>{average}%</strong></article>
            <article><span>Latest score</span><strong>{Math.round(attempts[0].score)}%</strong></article>
          </div>
          <ol className="summary-recent-attempts">
            {attempts.slice(0, 3).map((attempt) => (
              <li key={attempt.id}>
                <span>{new Date(attempt.completed_at).toLocaleDateString()}</span>
                <span>{attempt.correct_answers} of {attempt.total_questions} correct</span>
                <strong>{Math.round(attempt.score)}%</strong>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
