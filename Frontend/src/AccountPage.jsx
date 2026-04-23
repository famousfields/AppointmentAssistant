import { useNavigate } from 'react-router-dom'
import PublicPageShell from './PublicPageShell'
import AccountDeletionPanel from './AccountDeletionPanel'
import { PUBLIC_PATHS } from './appInfo'
import { useApi } from './apiContext'

export default function AccountPage({ onAccountDeleted }) {
  const navigate = useNavigate()
  const { session } = useApi()
  const currentUser = session?.user ?? null

  return (
    <PublicPageShell
      eyebrow="Account management"
      title="Manage your Appointment Assistant account"
      description="Use this page to review deletion guidance and, when signed in, remove your workspace account."
    >
      <div className="public-info-grid">
        <article className="public-info-card">
          <h3>Delete account access</h3>
          <p>
            Google Play requires an outside-the-app path for account deletion requests. This page serves that purpose for
            Appointment Assistant.
          </p>
          {!currentUser ? (
            <div className="public-page-actions">
              <button type="button" className="comments-button" onClick={() => navigate('/')}>
                Sign in to continue
              </button>
            </div>
          ) : (
            <p>
              Signed in as <strong>{currentUser.email || currentUser.name || 'Workspace user'}</strong>.
            </p>
          )}
        </article>

        <article className="public-info-card">
          <h3>Before you delete</h3>
          <ul className="public-info-list">
            <li>Deletion is permanent and removes workspace records tied to this account.</li>
            <li>Paid Stripe subscriptions may need to be cancelled first.</li>
            <li>
              Review the <a href={PUBLIC_PATHS.privacy}>privacy policy</a> if you need more detail about retained data.
            </li>
          </ul>
        </article>
      </div>

      {currentUser ? <AccountDeletionPanel standalone onDeleted={onAccountDeleted} /> : null}
    </PublicPageShell>
  )
}
