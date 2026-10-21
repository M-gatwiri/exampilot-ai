import { useState } from 'react'
import './App.css'
import Quiz from './Quiz.jsx'

const navigation = [
{ label: 'Dashboard', icon: '⌂' },
{ label: 'Practice quizzes', icon: '▤' },
{ label: 'My performance', icon: '↗' },
{ label: 'Revision plan', icon: '▧' },
]

const subjects = [
{
title: 'Cloud Concepts',
description: 'Understand cloud computing fundamentals.',
questions: 25,
progress: 72,
color: 'purple',
icon: '☁',
},
{
title: 'Azure Architecture & Services',
description: 'Explore Azure services and infrastructure.',
questions: 40,
progress: 48,
color: 'blue',
icon: '◇',
},
{
title: 'Azure Management & Governance',
description: 'Learn about cost, security, and governance.',
questions: 35,
progress: 31,
color: 'orange',
icon: '▦',
},
]

const activities = [
{ title: 'Cloud Concepts', date: 'Today', score: 80, color: 'purple' },
{ title: 'Azure Architecture & Services', date: 'Yesterday', score: 65, color: 'blue' },
{ title: 'Azure Management & Governance', date: '2 days ago', score: 55, color: 'orange' },
]

function App() {
const [activePage, setActivePage] = useState('Dashboard')

const handleNavigation = (page) => {
setActivePage(page)
}

return ( <div className="app-shell"> <aside className="sidebar">
<a className="brand" href="#" onClick={() => handleNavigation('Dashboard')}> <span className="brand-mark">E</span> <span className="brand-name">ExamPilot<span>AI</span></span> </a>

```
    <div className="sidebar-label">WORKSPACE</div>

    <nav className="navigation" aria-label="Main navigation">
      {navigation.map((item) => (
        <button
          className={`nav-item ${activePage === item.label ? 'active' : ''}`}
          key={item.label}
          onClick={() => handleNavigation(item.label)}
          aria-current={activePage === item.label ? 'page' : undefined}
        >
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
          {item.label === 'Practice quizzes' && (
            <span className="nav-count">3</span>
          )}
        </button>
      ))}
    </nav>

    <div className="sidebar-bottom">
      <div className="help-card">
        <div className="help-icon">✦</div>
        <h3>Keep learning!</h3>
        <p>Small steps every day lead to big results.</p>
      </div>

      <button className="profile-button">
        <span className="avatar">M</span>
        <span className="profile-details">
          <strong>My learning space</strong>
          <small>Free account</small>
        </span>
        <span className="profile-menu">···</span>
      </button>
    </div>
  </aside>

  <main className="main-content">
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <span>/</span> <strong>{activePage}</strong>
      </div>
      <div className="topbar-right">
        <span className="today-label">Your learning journey</span>
        <span className="top-avatar">M</span>
      </div>
    </header>

    <div className="page-content">
      {activePage === 'Practice quizzes' ? (
        <Quiz onExit={() => handleNavigation('Dashboard')} />
      ) : (
      <>
      <section className="welcome-section">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PERSONAL LEARNING SPACE</div>
          <h1>Let's make progress<span className="heading-period">.</span></h1>
          <p className="welcome-description">
            Every question brings you closer to your next big achievement.
          </p>
        </div>
        <div className="welcome-decoration" aria-hidden="true">
          <span className="decoration-ring ring-one" />
          <span className="decoration-ring ring-two" />
          <span className="decoration-star">✦</span>
        </div>
      </section>

      <section className="stats-grid" aria-label="Learning statistics">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon purple-icon">▤</span>
            <span className="stat-caption">ALL TIME</span>
          </div>
          <div className="stat-number">12 <span>quizzes</span></div>
          <p className="stat-description">Practice sessions completed</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon green-icon">↗</span>
            <span className="stat-caption">AVERAGE</span>
          </div>
          <div className="stat-number">74<span>%</span></div>
          <p className="stat-description">Your overall quiz score</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon orange-icon">♧</span>
            <span className="stat-caption">THIS WEEK</span>
          </div>
          <div className="stat-number">4 <span>days</span></div>
          <p className="stat-description">Keep your momentum going</p>
        </article>
      </section>

      <section className="study-goal">
        <div className="goal-copy">
          <div className="goal-icon">✦</div>
          <div>
            <p className="section-kicker">YOUR DAILY GOAL</p>
            <h2>A little practice goes a long way.</h2>
            <p className="goal-description">You're building a habit. Keep showing up for yourself.</p>
          </div>
        </div>
        <div className="goal-progress">
          <div className="goal-progress-label">
            <span>Today's progress</span>
            <strong>2 of 5 questions</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Daily question goal"
            aria-valuenow="40"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div className="progress-fill" style={{ width: '40%' }} />
          </div>
          <span className="goal-remaining">3 more questions to reach your goal</span>
        </div>
      </section>

      <section className="subjects-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">YOUR STUDY SPACE</p>
            <h2>Pick up where you left off</h2>
            <p className="section-description">Choose a topic and keep sharpening your knowledge.</p>
          </div>
          <button className="text-button" onClick={() => handleNavigation('Practice quizzes')}>
            All topics <span>→</span>
          </button>
        </div>

        <div className="subject-grid">
          {subjects.map((subject) => (
            <article className="subject-card" key={subject.title}>
              <div className="subject-card-top">
                <span className={`subject-icon ${subject.color}`}>{subject.icon}</span>
                <span className="topic-tag">AZ-900</span>
              </div>
              <h3>{subject.title}</h3>
              <p className="subject-description">{subject.description}</p>
              <div className="subject-meta">
                <span>{subject.questions} practice questions</span>
                <strong>{subject.progress}%</strong>
              </div>
              <div
                className="progress-track subject-progress"
                role="progressbar"
                aria-label={`${subject.title} progress`}
                aria-valuenow={subject.progress}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  className={`progress-fill ${subject.color}-fill`}
                  style={{ width: `${subject.progress}%` }}
                />
              </div>
              <button
                className="subject-button"
                onClick={() => handleNavigation('Practice quizzes')}
              >
                Practise topic <span>→</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="activity-section">
        <div className="section-heading activity-heading">
          <div>
            <p className="section-kicker">YOUR JOURNEY SO FAR</p>
            <h2>Recent practice</h2>
          </div>
          <button className="text-button" onClick={() => handleNavigation('My performance')}>
            View performance <span>→</span>
          </button>
        </div>

        <div className="activity-list">
          {activities.map((activity) => (
            <div className="activity-row" key={activity.title}>
              <span className={`activity-icon ${activity.color}`}>✓</span>
              <div className="activity-info">
                <strong>{activity.title}</strong>
                <span>{activity.date} · Practice quiz</span>
              </div>
              <div className="activity-score">
                <strong>{activity.score}%</strong>
                <span>Score</span>
              </div>
              <span className="activity-arrow">→</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="page-footer">
        <span>ExamPilot AI</span>
        <span>Built for your next breakthrough. <span className="footer-star">✦</span></span>
      </footer>
      </>
      )}
    </div>
  </main>
</div>


)
}

export default App
