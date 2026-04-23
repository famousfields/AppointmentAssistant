import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './App.css'

import { API_BASE } from './api'
import { APP_PATHS, PUBLIC_PATHS } from './appInfo'

export default function LoginPage({ onLogin, defaultMode = 'login' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const initialMode = new URLSearchParams(location.search).get('mode') === 'create' ? 'create' : defaultMode
  const [formMode, setFormMode] = useState(initialMode)
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCreateMode = formMode === 'create'

  useEffect(() => {
    setFormMode(initialMode)
    setStatus(null)
  }, [initialMode])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleModeChange = (mode) => {
    setFormMode(mode)
    setStatus(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isCreateMode) {
      if (formData.password !== formData.confirmPassword) {
        setStatus({ type: 'error', message: 'Passwords must match' })
        return
      }

      setIsSubmitting(true)
      setStatus(null)

      try {
        const response = await fetch(`${API_BASE}/users`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            displayName: formData.displayName,
            password: formData.password,
            email: formData.email
          })
        })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          const errorMessage =
            payload.error ||
            payload.message ||
            payload.errors?.[0]?.msg ||
            'Unable to create account'
          setStatus({ type: 'error', message: errorMessage })
        } else {
          setStatus({ type: 'success', message: payload.message || 'Account created' })
        }
      } catch (error) {
        setStatus({ type: 'error', message: error.message || 'Unable to reach the server' })
      } finally {
        setIsSubmitting(false)
      }

      return
    }

    setIsSubmitting(true)
    setStatus(null)

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          usernameOrEmail: formData.email,
          password: formData.password
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMessage =
          payload.error ||
          payload.message ||
          payload.errors?.[0]?.msg ||
          'Invalid credentials'
        setStatus({ type: 'error', message: errorMessage })
      } else {
        const userPayload = payload.user || {
          email: formData.email,
          name: formData.displayName || formData.email
        }
        setStatus({
          type: 'success',
          message: payload.message || 'Login successful'
        })
        onLogin?.({
          user: userPayload,
          accessToken: payload.accessToken
        })
        navigate(APP_PATHS.dashboard)
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Unable to reach the server' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="form-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isCreateMode}
            className={!isCreateMode ? 'active' : ''}
            onClick={() => handleModeChange('login')}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isCreateMode}
            className={isCreateMode ? 'active' : ''}
            onClick={() => handleModeChange('create')}
          >
            Create account
          </button>
        </div>

        <div>
          <h2>{isCreateMode ? 'Create your account' : 'Welcome back'}</h2>
          <p className="login-subtitle">
            {isCreateMode
              ? 'Create an account to start on the free plan, manage clients, track appointments, and keep every job organized in one place.'
              : 'Sign in to manage clients, review jobs, and stay on top of your upcoming appointments.'}
          </p>
        </div>

        {isCreateMode && (
          <>
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              value={formData.displayName}
              onChange={handleChange}
              required
            />

            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </>
        )}

        {!isCreateMode && (
          <>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </>
        )}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
        />

        {isCreateMode && (
          <>
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </>
        )}

        <button className="login-button" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isCreateMode
              ? 'Creating...'
              : 'Signing in...'
            : isCreateMode
              ? 'Create account'
              : 'Sign in'}
        </button>

        {status && <p className={`form-status form-status--${status.type}`}>{status.message}</p>}
        <p className="login-note">Use your account to access your client list, calendar, job history, and appointment updates.</p>
        <div className="login-legal-links">
          <a href={PUBLIC_PATHS.home}>Home</a>
          <a href={PUBLIC_PATHS.privacy}>Privacy policy</a>
          <a href={PUBLIC_PATHS.support}>Support</a>
          <a href={PUBLIC_PATHS.account}>Account management</a>
        </div>
      </form>
    </div>
  )
}
