import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './App.css'

const API_BASE = 'http://localhost:5000'

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate()
  const [formMode, setFormMode] = useState('login')
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    confirmPassword: ''
  })
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCreateMode = formMode === 'create'

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
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: formData.username,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: formData.username,
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
          email: formData.username,
          name: formData.username
        }
        setStatus({
          type: 'success',
          message: payload.message || 'Login successful'
        })
        onLogin?.(userPayload)
        navigate('/jobs')
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
              ? 'Set up your workspace with a few details to start tracking appointments.'
              : 'Sign in to manage jobs, clients, and follow-up notes in one place.'}
          </p>
        </div>

        <label htmlFor="username">{isCreateMode ? 'Username' : 'Email or username'}</label>
        <input
          id="username"
          name="username"
          type="text"
          value={formData.username}
          onChange={handleChange}
          required
        />

        {isCreateMode && (
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
        <p className="login-note">Your account actions stay connected to the existing backend endpoints.</p>
      </form>
    </div>
  )
}
