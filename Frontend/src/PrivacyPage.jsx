import PublicPageShell from './PublicPageShell'
import { PUBLIC_PATHS, SUPPORT_EMAIL } from './appInfo'

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy policy"
      title="Appointment Assistant privacy policy"
      description="This page explains what Appointment Assistant stores, why it is used, and how account owners can manage or delete their workspace data."
    >
      <div className="public-info-grid">
        <article className="public-info-card">
          <h3>What we collect</h3>
          <ul className="public-info-list">
            <li>Account details such as username, email address, and encrypted password.</li>
            <li>Client and job records that your business enters, including phone numbers, addresses, scheduling details, notes, statuses, and payments.</li>
            <li>Subscription and billing state needed to enforce plan limits and, when enabled, coordinate Stripe checkout or customer portal actions.</li>
            <li>Session and security data such as access tokens, refresh tokens, and request logs used to keep accounts signed in securely.</li>
          </ul>
        </article>

        <article className="public-info-card">
          <h3>How data is used</h3>
          <ul className="public-info-list">
            <li>To create, schedule, update, and display jobs for your business.</li>
            <li>To support login, session refresh, and account security.</li>
            <li>To show subscription status, plan limits, and billing actions.</li>
            <li>To maintain product reliability, troubleshoot issues, and improve the service.</li>
          </ul>
        </article>

        <article className="public-info-card">
          <h3>Sharing and processors</h3>
          <p>
            Appointment Assistant does not sell customer lists or job records. If billing is enabled for your workspace,
            payment-related subscription events may be processed through Stripe. Hosting, logging, and deployment providers
            may also process operational metadata required to run the service.
          </p>
        </article>

        <article className="public-info-card">
          <h3>Retention and deletion</h3>
          <p>
            Account data and workspace records remain available until the account owner deletes the workspace. When an
            account deletion request is completed, the app removes the account along with its jobs, clients that are no
            longer referenced, saved job types, refresh tokens, and subscription records.
          </p>
          <p>
            Use the <a href={PUBLIC_PATHS.account}>account management page</a> to request deletion.
          </p>
        </article>

        <article className="public-info-card">
          <h3>Your choices</h3>
          <p>
            Signed-in users can review plan details, manage subscriptions, and request account deletion from the billing
            or account pages. If a paid subscription is active, the app may direct you to Stripe first so billing can be
            cancelled before the workspace is removed.
          </p>
        </article>

        <article className="public-info-card">
          <h3>Support contact</h3>
          <p>
            Questions about privacy, deletion, or support can be started from the <a href={PUBLIC_PATHS.support}>support
            page</a>.
          </p>
          {SUPPORT_EMAIL ? (
            <p>
              Direct email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          ) : null}
        </article>
      </div>
    </PublicPageShell>
  )
}
