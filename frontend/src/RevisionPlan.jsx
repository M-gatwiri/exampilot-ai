import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.detail || 'Your revision plan could not be loaded.')
  }
  return data
}

export default function RevisionPlan({ onPractice }) {
  const [performance, setPerformance] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadRevisionData() {
      setStatus('loading')
      setError('')
      try {
        const data = await readResponse(await apiFetch('/attempts/performance/', { signal: controller.signal }))
        setPerformance(data)
        setStatus('ready')
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError instanceof TypeError
            ? 'Could not connect to your study history. Check that the backend is running and try again.'
            : loadError.message || 'Your revision plan could not be loaded.')
          setStatus('error')
        }
      }
    }

    loadRevisionData()
    return () => controller.abort()
  }, [retryCount])

  const insights = performance?.learning_insights
  const recommendations = insights?.recommendations || []

  return (
    <section className="performance-page revision-plan" aria-labelledby="revision-plan-title">
      <header className="performance-heading">
        <div>
          <p className="section-kicker">NEXT STEPS</p>
          <h1 id="revision-plan-title">Your revision plan</h1>
          <p className="section-description">Use your saved quiz answers to decide what to review next.</p>
        </div>
        <button className="quiz-primary-button" type="button" onClick={onPractice}>Start a practice quiz</button>
      </header>

      {status === 'loading' && <p className="performance-state" role="status">Building your revision plan from quiz history…</p>}
      {status === 'error' && (
        <div className="performance-error" role="alert">
          <p>{error}</p>
          <button className="quiz-secondary-button" type="button" onClick={() => setRetryCount((count) => count + 1)}>Retry</button>
        </div>
      )}
      {status === 'ready' && insights && (
        <>
          <section className="performance-section learning-insights" aria-labelledby="revision-summary-title">
            <div className="performance-section-heading">
              <div>
                <p className="section-kicker">BASED ON {insights.attempts_analyzed} COMPLETED QUIZ{insights.attempts_analyzed === 1 ? '' : 'Z'}</p>
                <h2 id="revision-summary-title">Recommended focus</h2>
              </div>
            </div>
            <p className="performance-muted">{insights.message}</p>

            {insights.status === 'insufficient_data' && (
              <div className="insight-empty-state">
                <h3>More quiz answers needed</h3>
                <p>Complete a practice quiz to build a topic-level study plan from your saved answers.</p>
                <button className="quiz-primary-button" type="button" onClick={onPractice}>Take a practice quiz</button>
              </div>
            )}

            {recommendations.length > 0 && (
              <ol className="insight-recommendation-list">
                {recommendations.map((item) => (
                  <li className={`insight-recommendation ${item.priority === 'high' ? 'high-priority' : ''}`} key={item.topic}>
                    <div className="insight-recommendation-heading">
                      <h3>{item.topic}</h3>
                      {typeof item.accuracy === 'number' && <strong>{item.accuracy}%</strong>}
                    </div>
                    <p>{item.recommendation}</p>
                    <span>{item.correct_answers} correct of {item.questions} answers</span>
                    <button className="text-button" type="button" onClick={onPractice}>Practice this area <span aria-hidden="true">→</span></button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {performance.domains?.length > 0 && (
            <section className="performance-section" aria-labelledby="revision-progress-title">
              <div className="performance-section-heading">
                <div>
                  <p className="section-kicker">SAVED ANSWERS</p>
                  <h2 id="revision-progress-title">Topic progress</h2>
                </div>
              </div>
              <div className="domain-list">
                {performance.domains.map((domain) => (
                  <article className="domain-card" key={domain.domain}>
                    <div className="domain-card-heading">
                      <h3>{domain.domain}</h3>
                      <strong>{domain.score}%</strong>
                    </div>
                    <p>{domain.correct_answers} correct of {domain.questions} answers</p>
                    <div className="progress-track" role="progressbar" aria-label={`${domain.domain} score`} aria-valuenow={domain.score} aria-valuemin="0" aria-valuemax="100">
                      <div className="progress-fill" style={{ width: `${domain.score}%` }} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  )
}
