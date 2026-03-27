import { useState } from 'react'
import './App.css'

export default function LoginPage() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setCredentials(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>Login</h2>
        <p className="login-subtitle">Enter your username and password to continue.</p>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          value={credentials.username}
          onChange={handleChange}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={credentials.password}
          onChange={handleChange}
          required
        />
        <button className="login-button" type="submit">
          Sign in
        </button>
        <p className="login-note">Not wired yet. Button is purely presentational.</p>
      </form>
    </div>
  )
}
