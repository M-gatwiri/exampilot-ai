import { useState } from 'react'
import Quiz from './Quiz.jsx'
import { apiFetch } from './api.js'

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Question generation failed. Please try again.')
  return data
}

export default function PracticeHub({ onComplete, onExit }) {
  const [quizStarted, setQuizStarted] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState(null)
  const [topic, setTopic] = useState('Azure Cloud Concepts')
  const [questionCount, setQuestionCount] = useState(10)
  const [generationStatus, setGenerationStatus] = useState('idle')
  const [generationError, setGenerationError] = useState('')

  const generateQuiz = async (event) => {
    event.preventDefault()
    setGenerationStatus('loading')
    setGenerationError('')
    try {
      const data = await readResponse(await apiFetch('/questions/generate_ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count: questionCount }),
      }))
      if (!Array.isArray(data.questions) || data.questions.length !== Number(questionCount)) {
        throw new Error('The AI service returned an incomplete quiz. Please retry.')
      }
      setGeneratedQuestions(data.questions)
      setQuizStarted(true)
    } catch (error) {
      setGenerationError(error.message || 'Question generation failed. Please try again.')
    } finally {
      setGenerationStatus('idle')
    }
  }

  if (quizStarted) {
    return <Quiz onExit={() => { setQuizStarted(false); setGeneratedQuestions(null) }} onComplete={onComplete} initialQuestions={generatedQuestions} />
  }

  return (
    <section className="practice-hub" aria-labelledby="practice-hub-title">
      <header className="page-heading">
        <div>
          <p className="section-kicker">PRACTICE HUB · AZ-900</p>
          <h1 id="practice-hub-title">Choose a focused practice session.</h1>
          <p className="section-description">Work through the question bank or generate a custom AI quiz, then review your score and answers.</p>
        </div>
      </header>

      <article className="practice-session-card">
        <div className="practice-session-mark" aria-hidden="true">A</div>
        <div className="practice-session-copy">
          <span className="session-label">QUESTION BANK · MIXED PRACTICE</span>
          <h2>Microsoft Azure Fundamentals</h2>
          <p>Answer the available questions in the bank. Your score and answer review are calculated and saved when you submit.</p>
          <dl className="session-facts">
            <div><dt>Question selection</dt><dd>All available questions</dd></div>
            <div><dt>Scoring</dt><dd>Calculated by the quiz service</dd></div>
          </dl>
          <div className="practice-session-actions">
            <button className="quiz-primary-button" type="button" onClick={() => setQuizStarted(true)}>Start practice session <span aria-hidden="true">→</span></button>
            <button className="quiz-secondary-button" type="button" onClick={onExit}>Back to dashboard</button>
          </div>
        </div>
      </article>

      <form className="practice-session-card ai-quiz-form" onSubmit={generateQuiz}>
        <div className="practice-session-mark" aria-hidden="true">✦</div>
        <div className="practice-session-copy">
          <span className="session-label">GROQ AI · CUSTOM PRACTICE</span>
          <h2>Generate a focused quiz</h2>
          <p>Choose a study topic and generate up to 60 fresh questions for your next session.</p>
          <label htmlFor="ai-quiz-topic">Topic</label>
          <input id="ai-quiz-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={160} required />
          <label htmlFor="ai-quiz-count">Number of questions</label>
          <select id="ai-quiz-count" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}>
            {[5, 10, 15, 20, 30, 45, 60].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
          <div className="practice-session-actions">
            <button className="quiz-primary-button" type="submit" disabled={generationStatus === 'loading'}>
              {generationStatus === 'loading' ? 'Generating quiz…' : 'Generate AI quiz'}
            </button>
          </div>
          {generationError && <p className="quiz-inline-error" role="alert">{generationError}</p>}
        </div>
      </form>

      <section className="practice-topic-section" aria-labelledby="practice-topics-title">
        <p className="section-kicker">AZ-900 EXAM AREAS</p>
        <h2 id="practice-topics-title">Topics covered by this certification</h2>
        <p className="section-description">The current question bank is served as a mixed quiz. Topic filtering is not available yet.</p>
        <div className="practice-topic-list">
          <article><span>01</span><div><h3>Cloud Concepts</h3><p>Cloud models, benefits, and service types.</p></div></article>
          <article><span>02</span><div><h3>Azure Architecture &amp; Services</h3><p>Core services, regions, and infrastructure.</p></div></article>
          <article><span>03</span><div><h3>Management &amp; Governance</h3><p>Cost management, security, and governance tools.</p></div></article>
        </div>
      </section>
    </section>
  )
}
