import { useState } from 'react'
import './App.css'
import Quiz from './Quiz.jsx'
import PerformanceDashboard from './PerformanceDashboard.jsx'
import PerformanceSummary from './PerformanceSummary.jsx'

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
color: 'purple',
icon: '☁',
},
{
title: 'Azure Architecture & Services',
description: 'Explore Azure services and infrastructure.',
color: 'blue',
icon: '◇',
},
{
title: 'Azure Management & Governance',
description: 'Learn about cost, security, and governance.',
color: 'orange',
icon: '▦',
},
]

function App() {
const [activePage, setActivePage] = useState('Dashboard')
const [latestResult, setLatestResult] = useState(null)

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
        <Quiz
          onExit={() => handleNavigation('Dashboard')}
          onComplete={(result) => { setLatestResult(result); handleNavigation('My performance') }}
        />
      ) : activePage === 'My performance' ? (
        <PerformanceDashboard
          latestResult={latestResult}
          onPractice={() => handleNavigation('Practice quizzes')}
        />
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

      <PerformanceSummary
        onOpenPerformance={() => handleNavigation('My performance')}
        onPractice={() => handleNavigation('Practice quizzes')}
      />

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
