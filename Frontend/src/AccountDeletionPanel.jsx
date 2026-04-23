import { useState } from 'react'
import { useApi } from './apiContext'

const getErrorMessage = (payload, fallback) =>
  payload?.error || payload?.message || payload?.errors?.[0]?.msg || fallback

export default function AccountDeletionPanel({ onDeleted, standalone = false }) {
  const { fetchWithAuth } = useApi()
  const [formData, setFormData] = useState({ password: '', confirmText: '' })
  const [isDeleting, setIsDeleting] = useState(false)
  const [status, setStatus] = useState(null)

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    setStatus(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsDeleting(true)
    setStatus(null)

    try {
      const response = await fetchWithAuth('/users/me', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (payload?.portalUrl) {
          window.location.assign(payload.portalUrl)
          return
        }

        throw new Error(getErrorMessage(payload, 'Unable to delete your account right now.'))
      }

      setStatus({ type: 'success', message: payload.message || 'Your account was deleted.' })
      onDeleted?.(payload)
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Unable to delete your account right now.' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <article className={`account-delete-panel${standalone ? ' account-delete-panel--standalone' : ''}`}>
      <div className="account-delete-panel__copy">
        <p className="public-page-eyebrow">Account management</p>
        <h3>Delete this workspace</h3>
        <p>
          This permanently removes the account, jobs, clients that are no longer referenced, saved job types, refresh
          tokens, and subscription records for this workspace.
        </p>
      </div>

      <form className="account-delete-form" onSubmit={handleSubmit}>
        <div className="form-grid form-grid--two">
          <label className="guided-field">
            <span className="guided-field__header">
              <span>Current password</span>
              <span className="guided-field__hint">Required</span>
            </span>
            <div className="guided-field__body">
              <span className="guided-field__icon">PW</span>
              <input
                className="guided-input"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                placeholder="Enter your current password"
                required
              />
            </div>
          </label>

          <label className="guided-field">
            <span className="guided-field__header">
              <span>Type DELETE</span>
              <span className="guided-field__hint">Safety check</span>
            </span>
            <div className="guided-field__body">
              <span className="guided-field__icon">OK</span>
              <input
                className="guided-input"
                type="text"
                name="confirmText"
                value={formData.confirmText}
                onChange={handleChange}
                autoComplete="off"
                placeholder="DELETE"
                required
              />
            </div>
          </label>
        </div>

        <div className="account-delete-actions">
          <button
            type="submit"
            className="comments-button comments-button--danger"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting account...' : 'Delete account'}
          </button>
          <p className="account-delete-actions__hint">
            If your workspace has an active paid Stripe subscription, the app may send you to Stripe first so billing can
            be cancelled before deletion.
          </p>
        </div>

        {status ? (
          <p className={status.type === 'error' ? 'form-error' : 'form-success-message'}>{status.message}</p>
        ) : null}
      </form>
    </article>
  )
}
