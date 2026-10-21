import { useState } from 'react'
import Quiz from './Quiz.jsx'

export default function PracticeHub({ onComplete, onExit }) {
  const [quizStarted, setQuizStarted] = useState(false)

  if (quizStarted) {
    return <Quiz onExit={() => setQuizStarted(false)} onComplete={onComplete} />
  }

  return (
    <section className="practice-hub" aria-labelledby="practice-hub-title">
      <header className="page-heading">
        <div>
          <p className="section-kicker">PRACTICE HUB · AZ-900</p>
          <h1 id="practice-hub-title">Choose a focused practice session.</h1>
          <p className="section-description">Work through questions from the current AZ-900 bank, then review your score and answers.</p>
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
