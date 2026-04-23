import PublicPageShell from './PublicPageShell'
import { PUBLIC_PATHS, SUPPORT_EMAIL } from './appInfo'

export default function SupportPage() {
  return (
    <PublicPageShell
      eyebrow="Support"
      title="Get help with Appointment Assistant"
      description="Use these support paths for billing questions, privacy requests, and account management."
    >
      <div className="public-info-grid">
        <article className="public-info-card">
          <h3>Billing and subscriptions</h3>
          <p>
            Signed-in customers can manage plans from the billing page inside the app. If Stripe is enabled for your
            workspace, paid-plan changes may open Stripe Checkout or the Stripe customer portal.
          </p>
        </article>

        <article className="public-info-card">
          <h3>Delete an account</h3>
          <p>
            Visit the <a href={PUBLIC_PATHS.account}>account management page</a> to request deletion of your app account
            and associated workspace data.
          </p>
        </article>

        <article className="public-info-card">
          <h3>Privacy information</h3>
          <p>
            Review the <a href={PUBLIC_PATHS.privacy}>privacy policy</a> for details about stored data, retention, and
            deletion behavior.
          </p>
        </article>

        <article className="public-info-card">
          <h3>Contact support</h3>
          {SUPPORT_EMAIL ? (
            <p>
              Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for product, billing, or privacy questions.
            </p>
          ) : (
            <p>
              Configure <code>VITE_SUPPORT_EMAIL</code> for a direct support inbox. Until then, use the signed-in billing
              and account pages for self-service actions.
            </p>
          )}
        </article>
      </div>
    </PublicPageShell>
  )
}
