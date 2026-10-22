import { useState } from 'react'
import './App.css'
import PracticeHub from './PracticeHub.jsx'
import PerformanceDashboard from './PerformanceDashboard.jsx'
import PerformanceSummary from './PerformanceSummary.jsx'
import { useAuth } from './auth/useAuth.js'
import { useTheme } from './theme/useTheme.js'

const navigation = [
  { label: 'Dashboard', icon: '⌂' },
  { label: 'Practice Hub', icon: '▤' },
  { label: 'My performance', icon: '↗' },
  { label: 'Revision plan', icon: '▧' },
]

const subjects = [
  { title: 'Cloud Concepts', description: 'Understand cloud computing fundamentals.', color: 'purple', icon: '☁' },
  { title: 'Azure Architecture & Services', description: 'Explore Azure services and infrastructure.', color: 'blue', icon: '◇' },
  { title: 'Azure Management & Governance', description: 'Learn about cost, security, and governance.', color: 'orange', icon: '▦' },
]

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [latestResult, setLatestResult] = useState(null)
  const { theme, toggleTheme } = useTheme()
  const {
    user, status, isConfigured, authError, clearAuthError, signInWithGoogle,
    signOut, profile, profileStatus, profileError, retryProfileSync,
  } = useAuth()

  const handleNavigation = (page) => setActivePage(page)
  const displayName = profile?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Learner'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => handleNavigation('Dashboard')} aria-label="ExamPilot AI dashboard">
          <span className="brand-mark">E</span>
          <span className="brand-name">ExamPilot<span>AI</span></span>
        </button>
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
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon" aria-hidden="true">✦</div>
            <h3>Keep learning!</h3>
            <p>Small steps every day lead to big results.</p>
          </div>
          <div className="profile-summary" aria-live="polite">
            <span className="avatar" aria-hidden="true">{user ? displayName.slice(0, 1).toUpperCase() : 'EP'}</span>
            <span className="profile-details">
              <strong>{user ? displayName : 'Practice workspace'}</strong>
              <small>{status === 'loading' ? 'Checking sign-in…' : user ? 'Signed in with Google' : 'Guest session'}</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{activePage}</strong></div>
          <div className="topbar-right">
            <span className="today-label">Your learning journey</span>
            <button
              className="theme-toggle-button"
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme. Current theme is ${theme}.`}
              aria-pressed={theme === 'dark'}
            >
              <span className="theme-toggle-icon" aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
              <span>{theme === 'dark' ? 'Dark' : 'Light'} theme</span>
            </button>
            {status === 'loading' ? (
              <span className="auth-status" role="status">Checking account…</span>
            ) : user ? (
              <button className="auth-button auth-button-secondary" type="button" onClick={signOut}>Sign out</button>
            ) : (
              <button className="auth-button" type="button" onClick={signInWithGoogle} disabled={!isConfigured}>
                Sign in with Google
              </button>
            )}
          </div>
        </header>

        {(authError || (!isConfigured && status !== 'loading') || profileError) && (
          <section className="auth-notice" aria-live="polite" aria-label="Account status">
            {authError && <p role="alert">{authError}</p>}
            {!isConfigured && status !== 'loading' && <p>Google sign-in is not configured. Add the Supabase URL and anon key to <code>frontend/.env</code> to enable accounts.</p>}
            {profileError && (
              <div role="alert">
                <p>{profileError}</p>
                <button type="button" className="auth-retry-button" onClick={retryProfileSync}>Retry profile sync</button>
              </div>
            )}
            {user && profileStatus === 'loading' && <p role="status">Syncing your ExamPilot profile…</p>}
            {user && profileStatus === 'ready' && <p role="status">Your ExamPilot profile is synced. Quiz history is not yet connected to learner accounts.</p>}
            {authError && <button type="button" className="auth-dismiss-button" onClick={clearAuthError}>Dismiss</button>}
          </section>
        )}

        <div className="page-content">
          {activePage === 'Practice Hub' ? (
            <PracticeHub
              onExit={() => handleNavigation('Dashboard')}
              onComplete={(result) => { setLatestResult(result); handleNavigation('My performance') }}
            />
          ) : activePage === 'My performance' ? (
            <PerformanceDashboard latestResult={latestResult} onPractice={() => handleNavigation('Practice Hub')} />
          ) : activePage === 'Revision plan' ? (
            <section className="quiz-state" aria-labelledby="revision-plan-title">
              <p className="section-kicker">NEXT STEPS</p>
              <h1 id="revision-plan-title">Revision plans are not available yet</h1>
              <p>Check your performance dashboard to see which topics may need more practice, or start another quiz.</p>
              <button className="quiz-primary-button" onClick={() => handleNavigation('My performance')}>View performance</button>
              <button className="quiz-secondary-button" onClick={() => handleNavigation('Practice Hub')}>Start a practice quiz</button>
            </section>
          ) : (
            <>
              <section className="welcome-section">
                <div>
                  <div className="eyebrow"><span className="eyebrow-dot" /> AZ-900 CERTIFICATION PREP</div>
                  <h1>Make your next study session count.</h1>
                  <p className="welcome-description">Practice from the question bank, then use your results to decide what to review next.</p>
                  <div className="welcome-actions">
                    <button className="quiz-primary-button" onClick={() => handleNavigation('Practice Hub')}>Start a practice session <span aria-hidden="true">→</span></button>
                    <button className="welcome-secondary-action" onClick={() => handleNavigation('My performance')}>View results</button>
                  </div>
                </div>
                <div className="welcome-aside" aria-label="Current certification track">
                  <span>EXAM TRACK</span>
                  <strong>AZ-900</strong>
                  <p>Microsoft Azure Fundamentals</p>
                  <span className="welcome-aside-note">Mixed question bank</span>
                </div>
              </section>
              <PerformanceSummary
                onOpenPerformance={() => handleNavigation('My performance')}
                onPractice={() => handleNavigation('Practice Hub')}
              />
              <section className="subjects-section">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">YOUR STUDY SPACE</p>
                    <h2>Study areas</h2>
                    <p className="section-description">Explore the topics covered in the AZ-900 question bank.</p>
                  </div>
                  <button className="text-button" onClick={() => handleNavigation('Practice Hub')}>Open practice hub <span aria-hidden="true">→</span></button>
                </div>
                <div className="subject-grid">
                  {subjects.map((subject) => (
                    <article className="subject-card" key={subject.title}>
                      <div className="subject-card-top">
                        <span className={`subject-icon ${subject.color}`} aria-hidden="true">{subject.icon}</span>
                        <span className="topic-tag">AZ-900</span>
                      </div>
                      <h3>{subject.title}</h3>
                      <p className="subject-description">{subject.description}</p>
                    </article>
                  ))}
                </div>
              </section>
              <footer className="page-footer">
                <span>ExamPilot AI</span>
                <span>Built for your next breakthrough. <span className="footer-star" aria-hidden="true">✦</span></span>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
