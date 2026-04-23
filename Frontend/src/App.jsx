import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import './App.css'
import JobForm from './JobForm'
import JobsList from './jobs'
import ClientsList from './clients'
import LoginPage from './LoginPage'
import CalendarPage from './CalendarPage'
import BillingPage from './BillingPage'
import PrivacyPage from './PrivacyPage'
import SupportPage from './SupportPage'
import AccountPage from './AccountPage'
import { API_BASE, getTokenExpiry } from './api'
import { ApiContext } from './apiContext'
import useSubscription from './useSubscription'
import { PUBLIC_PATHS } from './appInfo'

const SESSION_STORAGE_KEY = 'appointment-assistant:session'
const USAGE_LIMIT_PROMPT_STORAGE_PREFIX = 'appointment-assistant:usage-limit-prompt:'

const NAV_ITEMS = [
  { label: 'Calendar', path: '/calendar', description: 'View your jobs by day, week, month, or year.' },
  { label: 'View Jobs', path: '/jobs', description: 'Track every upcoming and completed job.', matchExact: true },
  { label: 'Clients', path: '/clients', description: 'Browse customers and their job history.' }
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
    description: 'See every scheduled job in daily, weekly, monthly, and yearly calendar views.'
  },
  '/billing': {
    title: 'Billing and plans',
    description: 'Review your plan, usage, monthly reset date, and upgrade options.'
  },
  [PUBLIC_PATHS.privacy]: {
    title: 'Privacy policy',
    description: 'Review how Appointment Assistant handles account, client, and job data.'
  },
  [PUBLIC_PATHS.support]: {
    title: 'Support',
    description: 'Find billing, privacy, and account support resources.'
  },
  [PUBLIC_PATHS.account]: {
    title: 'Account management',
    description: 'Manage account deletion and review your workspace data controls.'
  }
}

const STANDALONE_PUBLIC_PATHS = new Set([PUBLIC_PATHS.privacy, PUBLIC_PATHS.support, PUBLIC_PATHS.account])

const buildSessionRecord = ({ user, accessToken }) => {
  if (!accessToken) return null
  return {
    user,
    accessToken,
    expiresAt: getTokenExpiry(accessToken)
  }
}

const loadSessionFromStorage = () => {
  if (typeof window === 'undefined') return null
  const savedSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!savedSession) return null

  try {
    const parsed = JSON.parse(savedSession)
    if (!parsed.accessToken) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    return {
      ...parsed,
      expiresAt: parsed.expiresAt ?? getTokenExpiry(parsed.accessToken)
    }
  } catch (error) {
    console.error('Failed to read stored session:', error)
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

const getUsageLimitPromptStorageKey = (userId) =>
  `${USAGE_LIMIT_PROMPT_STORAGE_PREFIX}${userId ?? 'guest'}`

const formatBillingResetDate = (value) => {
  if (!value) return 'Unavailable'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const getUsageLimitPromptDetails = (summary) => {
  if (!summary || summary.planCode !== 'free' || !summary.entitlements?.creationBlocked) {
    return null
  }

  const usage = summary.usage || {}
  const clientsBlocked =
    usage.monthlyClientLimit !== null &&
    usage.monthlyClientLimit !== undefined &&
    Number(usage.monthlyClientCreations ?? 0) >= Number(usage.monthlyClientLimit)
  const jobsBlocked =
    usage.monthlyJobLimit !== null &&
    usage.monthlyJobLimit !== undefined &&
    Number(usage.monthlyJobCreations ?? 0) >= Number(usage.monthlyJobLimit)

  const exhaustedLimits = []
  if (clientsBlocked) exhaustedLimits.push(`${usage.monthlyClientLimit} clients`)
  if (jobsBlocked) exhaustedLimits.push(`${usage.monthlyJobLimit} jobs`)

  const limitLabel =
    exhaustedLimits.length === 0
      ? 'the included Free plan usage'
      : exhaustedLimits.length === 1
        ? exhaustedLimits[0]
        : `${exhaustedLimits.slice(0, -1).join(', ')} and ${exhaustedLimits[exhaustedLimits.length - 1]}`

  return {
    signature: `${summary.currentPeriodEndsAt}:${clientsBlocked ? 'clients' : 'no-clients'}:${jobsBlocked ? 'jobs' : 'no-jobs'}`,
    title: 'Free Plan Limit Reached',
    message: `You have used all ${limitLabel} included with the Free plan. Your allowance resets on ${formatBillingResetDate(summary.currentPeriodEndsAt)}. Open billing to upgrade and keep creating records.`
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
  const [session, setSession] = useState(loadSessionFromStorage)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const [usageLimitPrompt, setUsageLimitPrompt] = useState(null)
  const usageLimitPromptSignatureRef = useRef('')
  const location = useLocation()
  const navigate = useNavigate()
  const isLogin = location.pathname === '/'
  const isJobCreationPage = location.pathname === '/jobs/new'
  const isStandalonePublicPage = STANDALONE_PUBLIC_PATHS.has(location.pathname)

  const updateSessionFromLogin = useCallback((payload) => {
    const record = buildSessionRecord(payload)
    if (record) {
      setSession(record)
    }
  }, [])

  const currentUser = session?.user ?? null
  const showWorkspaceNewJobAction = currentUser && location.pathname !== '/jobs/new'

  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Unable to refresh session')
      }

      const payload = await response.json()
      const updated = buildSessionRecord({
        user: payload.user ?? session.user,
        accessToken: payload.accessToken
      })

      if (updated) {
        setSession(updated)
        return updated
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      setSession(null)
    }

    return null
  }, [session])

  const pageMeta = useMemo(() => {
    if (isLogin) {
      return {
        title: 'Appointment Assistant',
        description: 'A polished, dark workspace for managing jobs, clients, and follow-up notes.'
      }
    }

    return PAGE_META[location.pathname] || PAGE_META['/calendar']
  }, [isLogin, location.pathname])

  useEffect(() => {
    if (!session?.expiresAt) return undefined
    const refreshLeadTimeMs = 30 * 1000
    const now = Date.now()
    const delay = session.expiresAt - now - refreshLeadTimeMs
    if (delay <= 0) {
      refreshAccessToken()
      return undefined
    }

    const timer = setTimeout(() => refreshAccessToken(), delay)
    return () => clearTimeout(timer)
  }, [session?.expiresAt, refreshAccessToken])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!session) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return
    }

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const fetchWithAuth = useCallback(
    async (path, options = {}) => {
      const attempt = async (token) => {
        const headers = {
          ...(options.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
        return fetch(`${API_BASE}${path}`, {
          ...options,
          credentials: 'include',
          headers
        })
      }

      let response = await attempt(session?.accessToken)
      if (response.status === 401) {
        const refreshedSession = await refreshAccessToken()
        if (refreshedSession?.accessToken) {
          response = await attempt(refreshedSession.accessToken)
        }
      }

      return response
    },
    [session?.accessToken, refreshAccessToken]
  )
  const {
    summary: subscriptionSummary,
    loading: subscriptionLoading,
    error: subscriptionError,
    refreshSubscription,
    changePlan
  } = useSubscription(currentUser, fetchWithAuth)

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (error) {
      console.error('Logout warning:', error)
    }

    setSession(null)
    setShowLogoutMenu(false)
    navigate('/')
  }

  const handleAccountDeleted = useCallback(() => {
    setSession(null)
    setShowLogoutMenu(false)
    navigate('/')
  }, [navigate])

  const acknowledgeUsageLimitPrompt = useCallback((signature) => {
    if (!currentUser || typeof window === 'undefined' || !signature) return

    usageLimitPromptSignatureRef.current = signature
    window.sessionStorage.setItem(getUsageLimitPromptStorageKey(currentUser.id), signature)
  }, [currentUser])

  const openBillingFromUsagePrompt = useCallback(() => {
    if (usageLimitPrompt?.signature) {
      acknowledgeUsageLimitPrompt(usageLimitPrompt.signature)
    }

    setUsageLimitPrompt(null)
    navigate('/billing')
  }, [acknowledgeUsageLimitPrompt, navigate, usageLimitPrompt])

  const apiContextValue = useMemo(
    () => ({
      fetchWithAuth,
      session,
      subscriptionSummary,
      subscriptionLoading,
      subscriptionError,
      refreshSubscription,
      changePlan
    }),
    [
      changePlan,
      fetchWithAuth,
      refreshSubscription,
      session,
      subscriptionError,
      subscriptionLoading,
      subscriptionSummary
    ]
  )

  useEffect(() => {
    if (!currentUser || !subscriptionSummary) {
      setUsageLimitPrompt(null)
      usageLimitPromptSignatureRef.current = ''
      return
    }

    const prompt = getUsageLimitPromptDetails(subscriptionSummary)
    if (!prompt) {
      setUsageLimitPrompt(null)
      return
    }

    if (typeof window === 'undefined') return

    const storageKey = getUsageLimitPromptStorageKey(currentUser.id)
    const seenSignature = window.sessionStorage.getItem(storageKey) || ''

    if (location.pathname === '/billing') {
      acknowledgeUsageLimitPrompt(prompt.signature)
      setUsageLimitPrompt(null)
      return
    }

    if (seenSignature === prompt.signature || usageLimitPromptSignatureRef.current === prompt.signature) {
      return
    }

    setUsageLimitPrompt(prompt)
  }, [acknowledgeUsageLimitPrompt, currentUser, location.pathname, subscriptionSummary])

  return (
    <div className={`app-shell${isLogin || isStandalonePublicPage ? ' app-shell--login' : ''}`}>
      {!isLogin && !isStandalonePublicPage && (
        <aside className="app-sidebar">
          <div className="sidebar-brand-block">
            <div className="sidebar-brand-mark">AA</div>
            <div>
              <p className="sidebar-eyebrow">Appointment toolkit</p>
              <h1 className="sidebar-brand-title">Appointment Assistant</h1>
            </div>
          </div>

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
        {!isLogin && !isStandalonePublicPage && (
          <header className={`page-header${isJobCreationPage ? ' page-header--workflow' : ''}`}>
            <div className="page-header-content">
              <div className="page-header-main">
                <p className="page-header-kicker">Workspace overview</p>
                <h2>{pageMeta.title}</h2>
                <p className="page-header-description">{pageMeta.description}</p>
                {showWorkspaceNewJobAction ? (
                  <button
                    type="button"
                    className="sidebar-primary-action page-header-primary-action"
                    onClick={() => navigate('/jobs/new')}
                  >
                    <span className="sidebar-primary-action-icon">+</span>
                    New Job
                  </button>
                ) : null}
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
                {subscriptionSummary ? (
                  <button
                    type="button"
                    className={`page-header-plan${subscriptionSummary.entitlements?.creationBlocked ? ' page-header-plan--alert' : ''}`}
                    onClick={() => navigate('/billing')}
                  >
                    <span className="sidebar-section-label">Plan</span>
                    <strong>{subscriptionSummary.planName}</strong>
                    <span>
                      Resets {new Date(`${subscriptionSummary.currentPeriodEndsAt}T00:00:00`).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <span className="page-header-plan__action">Manage subscription</span>
                  </button>
                ) : null}
              </div>
            </div>
          </header>
        )}

        <section
          className={`page-content${isLogin || isStandalonePublicPage ? ' page-content--login' : ''}${isJobCreationPage ? ' page-content--workflow' : ''}`}
        >
          <ApiContext.Provider value={apiContextValue}>
            <Routes>
              <Route path="/" element={<LoginPage onLogin={updateSessionFromLogin} />} />
              <Route path="/jobs/new" element={<JobForm currentUser={currentUser} />} />
              <Route path="/jobs" element={<JobsList currentUser={currentUser} />} />
              <Route path="/clients" element={<ClientsList currentUser={currentUser} />} />
              <Route path="/calendar" element={<CalendarPage currentUser={currentUser} />} />
              <Route path="/billing" element={<BillingPage onAccountDeleted={handleAccountDeleted} />} />
              <Route path={PUBLIC_PATHS.privacy} element={<PrivacyPage />} />
              <Route path={PUBLIC_PATHS.support} element={<SupportPage />} />
              <Route path={PUBLIC_PATHS.account} element={<AccountPage onAccountDeleted={handleAccountDeleted} />} />
            </Routes>
          </ApiContext.Provider>
        </section>
      </main>
      {usageLimitPrompt ? (
        <div className="comments-modal-backdrop" role="presentation">
          <div className="comments-modal usage-limit-modal" role="dialog" aria-modal="true" aria-labelledby="usage-limit-modal-title">
            <div className="comments-modal-header">
              <p className="sidebar-section-label">Billing update</p>
              <h3 id="usage-limit-modal-title">{usageLimitPrompt.title}</h3>
              <p className="comments-modal-subtitle">{usageLimitPrompt.message}</p>
            </div>
            <div className="comments-modal-actions usage-limit-modal__actions">
              <button
                type="button"
                className="comments-modal-button comments-modal-button--primary"
                onClick={openBillingFromUsagePrompt}
              >
                Open billing
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App

