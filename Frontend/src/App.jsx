import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import JobForm from './JobForm'
import JobsList from './jobs'
import ClientsList from './clients'
import LoginPage from './LoginPage'
import CalendarPage from './CalendarPage'
import { API_BASE } from './api'

const SESSION_STORAGE_KEY = 'appointment-assistant:session'

const NAV_ITEMS = [
  { label: 'New Job', path: '/jobs/new', description: 'Capture a new appointment request.' },
  { label: 'View Jobs', path: '/jobs', description: 'Track every upcoming and completed job.', matchExact: true },
  { label: 'Clients', path: '/clients', description: 'Browse customers and their job history.' },
  { label: 'Calendar', path: '/calendar', description: 'View your jobs across the month.' }
]

const PAGE_META = {
  '/jobs/new': {
    title: 'Create a new job',
    description: 'Add an appointment with client details, scheduling info, and notes.'
  },
  '/jobs': {
    title: 'Job dashboard',
    description: 'Review active work, update statuses, and keep every appointment on track.'
  },
  '/clients': {
    title: 'Client relationships',
    description: 'See every client and drill into their job history in one place.'
  },
  '/calendar': {
    title: 'Calendar overview',
    description: 'See every scheduled job on a month-by-month calendar.'
  }
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

function AppContent() {
  const [session, setSession] = useState(() => {
    if (typeof window === 'undefined') return null

    const savedSession = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!savedSession) return null

    try {
      return JSON.parse(savedSession)
    } catch (error) {
      console.error('Failed to parse saved user session:', error)
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
  })
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isLogin = location.pathname === '/'

  const currentUser = session?.user ?? null

  const pageMeta = useMemo(() => {
    if (isLogin) {
      return {
        title: 'Appointment Assistant',
        description: 'A polished, dark workspace for managing jobs, clients, and follow-up notes.'
      }
    }

    return PAGE_META[location.pathname] || PAGE_META['/jobs']
  }, [isLogin, location.pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const handleLogout = async () => {
    try {
      if (session?.refreshToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken: session.refreshToken })
        })
      }
    } catch (error) {
      console.error('Logout warning:', error)
    }

    setSession(null)
    setShowLogoutMenu(false)
    navigate('/')
  }

  return (
    <div className={`app-shell${isLogin ? ' app-shell--login' : ''}`}>
      {!isLogin && (
        <aside className="app-sidebar">
          <div className="sidebar-brand-block">
            <div className="sidebar-brand-mark">AA</div>
            <div>
              <p className="sidebar-eyebrow">Appointment toolkit</p>
              <h1 className="sidebar-brand-title">Appointment Assistant</h1>
            </div>
          </div>

          <button type="button" className="sidebar-primary-action" onClick={() => navigate('/jobs/new')}>
            <span className="sidebar-primary-action-icon">+</span>
            New Job
          </button>

          <nav className="sidebar-nav" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.matchExact}
                className={({ isActive }) =>
                  `sidebar-nav-link${isActive ? ' sidebar-nav-link--active' : ''}`
                }
                onClick={() => setShowLogoutMenu(false)}
              >
                <span className="sidebar-nav-label">{item.label}</span>
                <span className="sidebar-nav-description">{item.description}</span>
              </NavLink>
            ))}
          </nav>

        </aside>
      )}

      <main className="app-main">
        {!isLogin && (
          <header className="page-header">
            <div className="page-header-content">
              <div>
                <p className="page-header-kicker">Workspace overview</p>
                <h2>{pageMeta.title}</h2>
                <p className="page-header-description">{pageMeta.description}</p>
              </div>

              <div className="page-header-account">
                <p className="sidebar-section-label">Signed in</p>
                {currentUser ? (
                  <div className="user-menu-container">
                    <button
                      className="user-email-button"
                      onClick={() => setShowLogoutMenu((prev) => !prev)}
                      type="button"
                    >
                      <span className="user-email-label">
                        {currentUser.name || currentUser.username || 'Workspace user'}
                      </span>
                      <span className="user-email-value">
                        {currentUser.email || 'No email available'}
                      </span>
                    </button>
                    {showLogoutMenu && (
                      <div className="logout-dropdown">
                        <button className="logout-button" onClick={handleLogout} type="button">
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="sidebar-secondary-action"
                    onClick={() => navigate('/')}
                  >
                    Return to login
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        <section className={`page-content${isLogin ? ' page-content--login' : ''}`}>
          <Routes>
            <Route path="/" element={<LoginPage onLogin={setSession} />} />
            <Route path="/jobs/new" element={<JobForm currentUser={currentUser} accessToken={session?.accessToken} />} />
            <Route path="/jobs" element={<JobsList currentUser={currentUser} accessToken={session?.accessToken} />} />
            <Route path="/clients" element={<ClientsList currentUser={currentUser} accessToken={session?.accessToken} />} />
            <Route path="/calendar" element={<CalendarPage currentUser={currentUser} accessToken={session?.accessToken} />} />
          </Routes>
        </section>
      </main>
    </div>
  )
}

export default App
