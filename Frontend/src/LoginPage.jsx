import { useState } from 'react'
import './App.css'

export default function LoginPage() {
  const [formMode, setFormMode] = useState('login')
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    confirmPassword: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
  }

  const isCreateMode = formMode === 'create'

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="form-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isCreateMode}
            className={!isCreateMode ? 'active' : ''}
            onClick={() => setFormMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isCreateMode}
            className={isCreateMode ? 'active' : ''}
            onClick={() => setFormMode('create')}
          >
            Create account
          </button>
        </div>
        <h2>{isCreateMode ? 'Create your account' : 'Welcome back'}</h2>
        <p className="login-subtitle">
          {isCreateMode
            ? 'Add a few details to set up your account.'
            : 'Enter your username and password to continue.'}
        </p>
        <label htmlFor="username">Username</label>
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
        <button className="login-button" type="submit">
          {isCreateMode ? 'Create account' : 'Sign in'}
        </button>
        <p className="login-note">Not wired yet. Button is purely presentational.</p>
      </form>
    </div>
  )
}
