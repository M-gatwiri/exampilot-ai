import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

function getOptions(options) {
  if (Array.isArray(options)) {
    return options.map((value, index) => [String.fromCharCode(65 + index), value])
  }

  if (options && typeof options === 'object') {
    return Object.entries(options)
  }

  return []
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.detail || 'The request could not be completed. Please try again.')
  }
  return data
}

export default function Quiz({ onExit }) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [validation, setValidation] = useState('')
  const [result, setResult] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadQuestions() {
      try {
        const data = await readResponse(await fetch(`${API_BASE_URL}/questions/`, { signal: controller.signal }))
        const list = Array.isArray(data) ? data : data.results
        if (!Array.isArray(list) || list.length === 0) {
          setError('No AZ-900 questions are available yet. Add questions to the backend question bank and try again.')
          setStatus('empty')
          return
        }
        setQuestions(list)
        setStatus('ready')
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError instanceof TypeError
            ? 'Could not connect to the quiz API. Start the local Django backend and try again.'
            : loadError.message || 'Could not load questions. Please try again.')
          setStatus('error')
        }
      }
    }

    loadQuestions()
    return () => controller.abort()
  }, [loadAttempt])

  const currentQuestion = questions[currentIndex]
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])

  const selectAnswer = (questionId, option) => {
    setAnswers((previous) => ({ ...previous, [questionId]: option }))
    setValidation('')
  }

  const submitQuiz = async () => {
    const unansweredIndex = questions.findIndex((question) => answers[question.id] === undefined)
    if (unansweredIndex !== -1) {
      setCurrentIndex(unansweredIndex)
      setValidation(`Please answer all questions before submitting. Question ${unansweredIndex + 1} is unanswered.`)
      return
    }

    if (!window.confirm('Submit your quiz? You will not be able to change your answers afterward.')) return

    setStatus('submitting')
    setError('')
    try {
      const data = await readResponse(await fetch(`${API_BASE_URL}/attempts/submit_quiz/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      }))
      setResult(data)
      setStatus('complete')
    } catch (submitError) {
      setError(submitError instanceof TypeError
        ? 'Could not reach the quiz API. Your answers are still here; check that the backend is running and try again.'
        : submitError.message || 'Your quiz could not be submitted. Your answers are still here; please try again.')
      setStatus('ready')
    }
  }

  if (status === 'loading') {
    return <section className="quiz-state" aria-live="polite"><p>Loading AZ-900 questions…</p></section>
  }

  if (status === 'error') {
    return (
      <section className="quiz-state" role="alert">
        <p className="section-kicker">PRACTICE QUIZ</p>
        <h1>Quiz unavailable</h1>
        <p>{error}</p>
        <button className="quiz-primary-button" onClick={() => { setError(''); setStatus('loading'); setLoadAttempt((attempt) => attempt + 1) }}>Try again</button>
        <button className="quiz-secondary-button" onClick={onExit}>Back to dashboard</button>
      </section>
    )
  }

  if (status === 'empty') {
    return (
      <section className="quiz-state" aria-live="polite">
        <p className="section-kicker">PRACTICE QUIZ</p>
        <h1>No questions available</h1>
        <p>{error}</p>
        <button className="quiz-secondary-button" onClick={onExit}>Back to dashboard</button>
      </section>
    )
  }

  if (status === 'complete') {
    return (
      <section className="quiz-state quiz-result" aria-live="polite">
        <p className="section-kicker">QUIZ SUBMITTED</p>
        <h1>Practice complete</h1>
        <p className="quiz-result-score">{Math.round(result.score)}<span>%</span></p>
        <p>You answered {result.correct_answers} of {result.total_questions} questions correctly.</p>
        <button className="quiz-primary-button" onClick={onExit}>Return to dashboard</button>
      </section>
    )
  }

  const options = getOptions(currentQuestion.options)
  const progress = ((currentIndex + 1) / questions.length) * 100

  return (
    <section className="quiz-page" aria-labelledby="quiz-title">
      <div className="quiz-heading">
        <div>
          <p className="section-kicker">AZ-900 PRACTICE</p>
          <h1 id="quiz-title">Knowledge check</h1>
          <p className="section-description">Take your time and choose the best answer.</p>
        </div>
        <button className="quiz-exit-button" onClick={onExit}>Exit quiz</button>
      </div>

      <div className="quiz-progress-block">
        <div className="quiz-progress-label">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>{answeredCount} answered</span>
        </div>
        <div className="progress-track" role="progressbar" aria-label="Quiz progress" aria-valuenow={currentIndex + 1} aria-valuemin="1" aria-valuemax={questions.length}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <article className="quiz-question-card">
        <p className="quiz-question-number">QUESTION {String(currentIndex + 1).padStart(2, '0')}</p>
        <h2>{currentQuestion.question_text}</h2>
        <fieldset className="quiz-options">
          <legend className="visually-hidden">Select one answer</legend>
          {options.map(([key, label]) => {
            const selected = answers[currentQuestion.id] === key
            return (
              <label className={`quiz-option ${selected ? 'selected' : ''}`} key={key}>
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={key}
                  checked={selected}
                  onChange={() => selectAnswer(currentQuestion.id, key)}
                />
                <span className="quiz-option-key" aria-hidden="true">{key}</span>
                <span>{label}</span>
              </label>
            )
          })}
          {options.length === 0 && <p className="quiz-inline-error">This question has no answer options. Please contact the course administrator.</p>}
        </fieldset>
      </article>

      <div className="quiz-controls">
        <button className="quiz-secondary-button" onClick={() => { setCurrentIndex((index) => index - 1); setValidation('') }} disabled={currentIndex === 0}>
          <span aria-hidden="true">←</span> Previous
        </button>
        <span className="quiz-control-count">{answeredCount} of {questions.length} answered</span>
        {currentIndex < questions.length - 1 ? (
          <button className="quiz-primary-button" onClick={() => { setCurrentIndex((index) => index + 1); setValidation('') }}>
            Next question <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button className="quiz-primary-button" onClick={submitQuiz} disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Submitting…' : 'Submit quiz'}
          </button>
        )}
      </div>
      {(validation || error) && <p className="quiz-inline-error" role="alert">{validation || error}</p>}
    </section>
  )
}
