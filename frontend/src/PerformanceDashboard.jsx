import { useEffect, useMemo, useRef, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

function optionLabel(options, key) {
  if (Array.isArray(options)) {
    const index = key.charCodeAt(0) - 65
    return options[index] || key
  }
  const matchingKey = Object.keys(options || {}).find((option) => option.toUpperCase() === key.toUpperCase())
  return options?.[matchingKey] || key
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
}

async function readResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || body.detail || 'The request could not be completed.')
  }
  return body
}

function AnswerExplanation({ item }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [explanation, setExplanation] = useState(null)
  const [error, setError] = useState('')
  const requestInFlight = useRef(false)

  const loadExplanation = async () => {
    if (requestInFlight.current) return
    requestInFlight.current = true
    setOpen(true)
    setStatus('loading')
    setError('')
    try {
      const data = await readResponse(await fetch(
        `${API_BASE_URL}/questions/${item.question_id}/explain_answer/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected_answer: item.selected_answer }),
        },
      ))
      setExplanation(data)
      setStatus('ready')
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? 'Could not reach the explanation service. Your saved answer guidance is still available above.'
        : requestError.message || 'An explanation could not be generated. Your saved answer guidance is still available above.')
      setStatus('error')
    } finally {
      requestInFlight.current = false
    }
  }

  const toggleExplanation = () => {
    if (status === 'idle' || status === 'error') {
      loadExplanation()
    } else if (status !== 'loading') {
      setOpen((value) => !value)
    }
  }

  return (
    <div className="answer-explanation">
      <button
        className="explanation-toggle"
        type="button"
        onClick={toggleExplanation}
        disabled={status === 'loading'}
        aria-expanded={open}
        aria-controls={`answer-explanation-${item.question_id}`}
      >
        {status === 'loading' ? 'Generating explanation…' : status === 'error' ? 'Retry AI explanation' : open ? 'Hide AI explanation' : 'Explain my answer'}
      </button>
      {open && (
        <div className="ai-explanation-panel" id={`answer-explanation-${item.question_id}`} aria-live="polite">
          {status === 'loading' && <p role="status">Preparing a question-specific explanation…</p>}
          {status === 'error' && <p role="alert">{error}</p>}
          {status === 'ready' && (
            <>
              <p className="explanation-source">{explanation.fallback ? 'Saved guidance' : 'AI learning explanation'}</p>
              {explanation.fallback && <p className="explanation-notice" role="status">{explanation.notice}</p>}
              <p>{explanation.explanation}</p>
              {explanation.retryable && (
                <button className="explanation-retry" type="button" onClick={loadExplanation}>
                  Try AI explanation again
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AttemptReview({ attempt }) {
  if (!attempt.review_available || attempt.question_results.length === 0) {
    return <p className="performance-muted">Question by question review is unavailable for this older attempt.</p>
  }

  return (
    <ol className="review-list">
      {attempt.question_results.map((item, index) => (
        <li className={`review-item ${item.correct ? 'review-correct' : 'review-incorrect'}`} key={`${attempt.id}-${item.question_id}-${index}`}>
          <div className="review-heading">
            <span className="review-outcome">{item.correct ? 'Correct' : 'Review this answer'}</span>
            <span className="topic-tag">{item.domain}</span>
          </div>
          <h3>{item.question_text}</h3>
          <p><strong>Your answer:</strong> {item.selected_answer} — {optionLabel(item.options, item.selected_answer)}</p>
          <p><strong>Correct answer:</strong> {item.correct_answer} — {optionLabel(item.options, item.correct_answer)}</p>
          {item.explanation && <p className="review-explanation"><strong>Saved explanation:</strong> {item.explanation}</p>}
          <AnswerExplanation item={item} />
        </li>
      ))}
    </ol>
  )
}

export default function PerformanceDashboard({ latestResult, onPractice }) {
  const [performance, setPerformance] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [insightStatus, setInsightStatus] = useState('idle')
  const [insightError, setInsightError] = useState('')
  const [insights, setInsights] = useState('')
  const [selectedAttemptId, setSelectedAttemptId] = useState(() => latestResult?.attempt_id || latestResult?.id || null)

  const [retryCount, setRetryCount] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function loadPerformance() {
      setStatus('loading')
      setError('')
      try {
        const data = await readResponse(await fetch(`${API_BASE_URL}/attempts/performance/`, { signal: controller.signal }))
        setPerformance(data)
        setStatus('ready')
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError instanceof TypeError
            ? 'Could not connect to performance history. Check that the backend is running and try again.'
            : loadError.message || 'Performance history could not be loaded.')
          setStatus('error')
        }
      }
    }
    loadPerformance()
    return () => controller.abort()
  }, [retryCount])

  const attempts = useMemo(() => {
    const loaded = performance?.attempts || []
    if (!latestResult) return loaded
    const resultId = latestResult.attempt_id || latestResult.id
    const current = {
      id: resultId || 'just-submitted',
      score: latestResult.score,
      correct_answers: latestResult.correct_answers,
      total_questions: latestResult.total_questions,
      completed_at: latestResult.completed_at,
      question_results: latestResult.question_results || [],
      review_available: (latestResult.question_results || []).length === latestResult.total_questions,
    }
    return [current, ...loaded.filter((attempt) => attempt.id !== resultId)]
  }, [latestResult, performance])

  const latest = attempts[0]
  const selectedAttempt = attempts.find((attempt) => attempt.id === selectedAttemptId) || latest
  const domains = performance?.domains || []
  const historyForChart = [...attempts].filter((attempt) => typeof attempt.score === 'number').reverse()
  const hasTopicData = domains.length > 0

  const requestInsights = async () => {
    setInsightStatus('loading')
    setInsightError('')
    setInsights('')
    try {
      const topicScores = Object.fromEntries(domains.map((domain) => [domain.domain, domain.score]))
      const data = await readResponse(await fetch(`${API_BASE_URL}/attempts/generate_insights/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_scores: topicScores }),
      }))
      setInsights(data.insights || '')
      setInsightStatus('ready')
    } catch (requestError) {
      setInsightError(requestError instanceof TypeError
        ? 'Could not reach the recommendations service. Your results are still available below.'
        : requestError.message || 'Recommendations are unavailable right now. Your results are still available below.')
      setInsightStatus('error')
    }
  }

  return (
    <section className="performance-page" aria-labelledby="performance-title">
      <header className="performance-heading">
        <div>
          <p className="section-kicker">YOUR LEARNING JOURNEY</p>
          <h1 id="performance-title">Quiz results &amp; performance</h1>
          <p className="section-description">Review your answers and see where to focus next.</p>
        </div>
        <button className="quiz-primary-button" onClick={onPractice}>Practice again</button>
      </header>

      {status === 'loading' && !latest && <p className="performance-state" role="status">Loading your results…</p>}
      {status === 'error' && (
        <div className="performance-error" role="alert">
          <p>{error}</p>
          <button className="quiz-secondary-button" onClick={() => setRetryCount((count) => count + 1)}>Retry</button>
        </div>
      )}

      {status === 'ready' && attempts.length === 0 && (
        <div className="performance-empty">
          <h2>No quiz history yet</h2>
          <p>Complete a practice quiz to see your score, answer review, and topic progress here.</p>
          <button className="quiz-primary-button" onClick={onPractice}>Start a practice quiz</button>
        </div>
      )}

      {latest && (
        <>
          <section className="latest-result-card" aria-labelledby="latest-result-title">
            <div className="latest-result-score">
              <p className="section-kicker">LATEST RESULT</p>
              <h2 id="latest-result-title">{Math.round(latest.score)}<span>%</span></h2>
            </div>
            <dl className="result-facts">
              <div><dt>Correct</dt><dd>{latest.correct_answers} / {latest.total_questions}</dd></div>
              <div><dt>Completed</dt><dd>{formatDate(latest.completed_at)}</dd></div>
            </dl>
          </section>

          <section className="performance-section" aria-labelledby="topic-performance-title">
            <div className="performance-section-heading">
              <div>
                <p className="section-kicker">TOPIC BREAKDOWN</p>
                <h2 id="topic-performance-title">Strengths and focus areas</h2>
              </div>
            </div>
            {domains.length > 0 ? (
              <div className="domain-list">
                {domains.map((domain) => (
                  <article className="domain-card" key={domain.domain}>
                    <div className="domain-card-heading">
                      <h3>{domain.domain}</h3>
                      <strong>{domain.score}%</strong>
                    </div>
                    <p>{domain.correct_answers} correct of {domain.questions} answers</p>
                    <div className="progress-track" role="progressbar" aria-label={`${domain.domain} score`} aria-valuenow={domain.score} aria-valuemin="0" aria-valuemax="100">
                      <div className="progress-fill" style={{ width: `${domain.score}%` }} />
                    </div>
                    <span className={`domain-tag ${domain.score < 70 ? 'needs-practice' : 'doing-well'}`}>
                      {domain.score < 70 ? 'Focus area' : 'Strength'}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="performance-muted">Topic breakdown is not available for these attempts yet. New quizzes will include topic-level results.</p>
            )}
          </section>

          <section className="performance-section" aria-labelledby="recommendations-title">
            <div className="performance-section-heading">
              <div>
                <p className="section-kicker">NEXT STEPS</p>
                <h2 id="recommendations-title">Revision recommendations</h2>
              </div>
              <button className="quiz-secondary-button" onClick={requestInsights} disabled={!hasTopicData || insightStatus === 'loading'}>
                {insightStatus === 'loading' ? 'Generating…' : insightStatus === 'ready' ? 'Refresh recommendations' : 'Get recommendations'}
              </button>
            </div>
            {!hasTopicData && <p className="performance-muted">Complete a quiz with topic data to request recommendations.</p>}
            {insightError && <p className="performance-error-text" role="alert">{insightError}</p>}
            {insightStatus === 'loading' && <p className="performance-muted" role="status">Generating recommendations from your topic scores…</p>}
            {insights && <p className="insight-copy">{insights}</p>}
            {hasTopicData && !insights && insightStatus !== 'loading' && (
              <p className="performance-muted">Choose “Get recommendations” to ask the existing insights service for guidance based on these scores.</p>
            )}
          </section>

          <section className="performance-section" aria-labelledby="score-trend-title">
            <p className="section-kicker">REAL QUIZ ATTEMPTS</p>
            <h2 id="score-trend-title">Score trend</h2>
            {historyForChart.length > 1 ? (
              <ol className="trend-list" aria-label="Quiz scores from oldest to newest">
                {historyForChart.map((attempt) => (
                  <li key={attempt.id}>
                    <span>{formatDate(attempt.completed_at)}</span>
                    <div className="progress-track" role="progressbar" aria-label={`Score ${Math.round(attempt.score)} percent`} aria-valuenow={attempt.score} aria-valuemin="0" aria-valuemax="100">
                      <div className="progress-fill" style={{ width: `${attempt.score}%` }} />
                    </div>
                    <strong>{Math.round(attempt.score)}%</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="performance-muted">Complete another quiz to see how your scores change over time.</p>
            )}
          </section>

          <section className="performance-section" aria-labelledby="attempt-history-title">
            <p className="section-kicker">PAST PRACTICE</p>
            <h2 id="attempt-history-title">Quiz history</h2>
            <ol className="attempt-history">
              {attempts.map((attempt) => (
                <li key={attempt.id}>
                  <button
                    className="history-attempt-button"
                    onClick={() => setSelectedAttemptId(attempt.id)}
                    aria-pressed={selectedAttempt.id === attempt.id}
                  >
                    <span>{formatDate(attempt.completed_at)}</span>
                    <span>{attempt.correct_answers} / {attempt.total_questions} correct</span>
                    <strong>{Math.round(attempt.score)}%</strong>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className="performance-section" aria-labelledby="answer-review-title">
            <p className="section-kicker">SELECTED QUIZ</p>
            <h2 id="answer-review-title">Answer review</h2>
            <AttemptReview attempt={selectedAttempt} />
          </section>
        </>
      )}
    </section>
  )
}
