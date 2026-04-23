import { useMemo, useState } from 'react'
import { useApi } from './apiContext'
import AccountDeletionPanel from './AccountDeletionPanel'
import { PUBLIC_PATHS } from './appInfo'

const DEFAULT_BILLING_PLANS = [
  {
    code: 'free',
    name: 'Free',
    priceLabel: '$0',
    userLimit: 1,
    monthlyClientLimit: 10,
    monthlyJobLimit: 25,
    description: 'Try the full scheduling flow with monthly creation limits.',
    features: [
      '1 user',
      '10 new clients per month',
      '25 new jobs per month',
      'Calendar, clients, notes, and payment tracking'
    ],
    canSelfServe: true
  },
  {
    code: 'starter',
    name: 'Starter',
    priceLabel: '$14.99/mo',
    userLimit: 1,
    monthlyClientLimit: null,
    monthlyJobLimit: null,
    description: 'Unlimited records for solo operators.',
    features: [
      '1 user',
      'Unlimited clients and jobs',
      'Custom job types and calendar colors',
      'Core scheduling workflow'
    ],
    canSelfServe: true
  },
  {
    code: 'team',
    name: 'Team',
    priceLabel: '$39.99/mo',
    userLimit: 5,
    monthlyClientLimit: null,
    monthlyJobLimit: null,
    description: 'Shared scheduling for small crews.',
    features: [
      'Up to 5 users',
      'Unlimited clients and jobs',
      'Shared scheduling foundations',
      'Built for growing teams'
    ],
    canSelfServe: true
  },
  {
    code: 'pro',
    name: 'Pro',
    priceLabel: '$79.99/mo',
    userLimit: 15,
    monthlyClientLimit: null,
    monthlyJobLimit: null,
    description: 'Advanced tools for scaling service businesses.',
    features: [
      'Up to 15 users',
      'Unlimited clients and jobs',
      'Best fit for automation and advanced workflows',
      'Mobile and desktop access'
    ],
    canSelfServe: true
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'From $249/mo',
    userLimit: null,
    monthlyClientLimit: null,
    monthlyJobLimit: null,
    description: 'Custom onboarding, integrations, and support.',
    features: [
      'Custom user limits',
      'Priority onboarding',
      'Custom integrations',
      'Contact sales'
    ],
    canSelfServe: false
  }
]

const formatResetDate = (value) => {
  if (!value) return 'Unavailable'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatUsageLabel = (used, limit, noun) =>
  limit === null ? `Unlimited ${noun}` : `${used} / ${limit} ${noun}`

export default function BillingPage({ onAccountDeleted }) {
  const {
    subscriptionSummary,
    subscriptionLoading,
    subscriptionError,
    changePlan
  } = useApi()
  const [status, setStatus] = useState('')
  const [savingPlanCode, setSavingPlanCode] = useState('')

  const plans = subscriptionSummary?.plans?.length ? subscriptionSummary.plans : DEFAULT_BILLING_PLANS
  const usageRows = useMemo(
    () => [
      {
        label: 'Clients this month',
        used: subscriptionSummary?.usage?.monthlyClientCreations ?? 0,
        limit: subscriptionSummary?.usage?.monthlyClientLimit ?? null,
        noun: 'clients'
      },
      {
        label: 'Jobs this month',
        used: subscriptionSummary?.usage?.monthlyJobCreations ?? 0,
        limit: subscriptionSummary?.usage?.monthlyJobLimit ?? null,
        noun: 'jobs'
      }
    ],
    [subscriptionSummary]
  )

  const handleSelectPlan = async (planCode) => {
    setSavingPlanCode(planCode)
    setStatus('')

    try {
      const payload = await changePlan(planCode)
      if (payload?.checkoutUrl) {
        window.location.assign(payload.checkoutUrl)
        return
      }

      if (payload?.portalUrl) {
        window.location.assign(payload.portalUrl)
        return
      }

      if (payload?.subscription?.planName) {
        setStatus(`Your workspace is now on the ${payload.subscription.planName} plan.`)
      } else if (payload?.message) {
        setStatus(payload.message)
      } else {
        setStatus('Your plan was updated.')
      }
    } catch (error) {
      setStatus(error.message || 'Unable to update the plan right now.')
    } finally {
      setSavingPlanCode('')
    }
  }

  if (subscriptionLoading && !subscriptionSummary) {
    return (
      <section className="billing-page">
        <div className="billing-hero">
          <h3>Billing</h3>
          <p>Loading your plan details...</p>
        </div>
        <div className="billing-plan-grid">
          {plans.map((plan) => (
            <article key={plan.code} className="billing-plan-card">
              <div className="billing-plan-card__header">
                <div>
                  <h4>{plan.name}</h4>
                  <p>{plan.description}</p>
                </div>
                <strong>{plan.priceLabel}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="billing-page">
      <div className="billing-hero">
        <div>
          <h3>Billing and plans</h3>
          <p>Choose the tier that fits the size of your business and keep an eye on your monthly usage.</p>
        </div>
        {subscriptionSummary ? (
          <div className="billing-current-plan">
            <span className="billing-current-plan__eyebrow">Current plan</span>
            <strong>{subscriptionSummary.planName}</strong>
            <span>{subscriptionSummary.priceLabel}</span>
            <span>Resets on {formatResetDate(subscriptionSummary.currentPeriodEndsAt)}</span>
          </div>
        ) : null}
      </div>

      {subscriptionSummary ? (
        subscriptionSummary.checkoutMode === 'manual_preview' ? (
          <div className="billing-notice">
            Stripe is not fully configured yet, so plan changes are still using the local preview flow.
          </div>
        ) : (
          <div className="billing-notice">
            Stripe Checkout and the customer portal are active for paid plans.
          </div>
        )
      ) : null}

      {subscriptionSummary ? (
        <div className="billing-usage-grid">
          {usageRows.map((item) => {
            const limit = item.limit
            const ratio = limit === null ? 0 : Math.min(item.used / limit, 1)

            return (
              <article key={item.label} className="billing-usage-card">
                <span className="billing-usage-card__label">{item.label}</span>
                <strong>{formatUsageLabel(item.used, limit, item.noun)}</strong>
                {limit !== null ? (
                  <>
                    <div className="billing-usage-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(ratio * 100, 6)}%` }} />
                    </div>
                    <p>{Math.max(limit - item.used, 0)} remaining before the next reset.</p>
                  </>
                ) : (
                  <p>Your current plan does not cap monthly record creation.</p>
                )}
              </article>
            )
          })}
        </div>
      ) : null}

      {!subscriptionSummary && (
        <div className="billing-notice">
          Showing the default plan catalog while billing details load. If this persists, check the backend log for the billing summary error.
        </div>
      )}

      {subscriptionSummary?.entitlements?.creationBlocked ? (
        <div className="billing-alert">
          New client and job creation is paused until {formatResetDate(subscriptionSummary.currentPeriodEndsAt)} or until you move to a paid plan.
        </div>
      ) : null}

      {status ? (
        <p className={status.toLowerCase().includes('unable') ? 'form-error' : 'form-success-message'}>
          {status}
        </p>
      ) : null}
      {subscriptionError ? <p className="form-error">{subscriptionError}</p> : null}

      <div className="billing-plan-grid">
        {plans.map((plan) => {
          const isCurrent = subscriptionSummary?.planCode === plan.code
          const canSelect = plan.canSelfServe !== false

          return (
            <article
              key={plan.code}
              className={`billing-plan-card${isCurrent ? ' billing-plan-card--current' : ''}`}
            >
              <div className="billing-plan-card__header">
                <div>
                  <h4>{plan.name}</h4>
                  <p>{plan.description}</p>
                </div>
                <strong>{plan.priceLabel}</strong>
              </div>

              <p className="billing-plan-card__limit">
                {plan.userLimit === null ? 'Custom seats' : `${plan.userLimit} user${plan.userLimit === 1 ? '' : 's'}`}
              </p>

              <ul className="billing-plan-card__features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              {canSelect ? (
                <button
                  type="button"
                  className={`comments-button${isCurrent ? ' comments-button--ghost' : ''}`}
                  disabled={Boolean(savingPlanCode)}
                  onClick={() => handleSelectPlan(plan.code)}
                >
                  {savingPlanCode === plan.code
                    ? 'Saving...'
                    : isCurrent
                      ? 'Current plan'
                      : subscriptionSummary?.planCode === 'free'
                        ? `Choose ${plan.name}`
                        : 'Open Stripe'}
                </button>
              ) : (
                <button type="button" className="comments-button comments-button--ghost" disabled>
                  Contact sales
                </button>
              )}
            </article>
          )
        })}
      </div>

      <div className="public-info-grid billing-support-grid">
        <article className="public-info-card">
          <h3>Policy and support</h3>
          <p>Keep your workspace launch-ready with quick access to privacy, support, and account-management pages.</p>
          <div className="public-page-actions">
            <a className="comments-button comments-button--ghost" href={PUBLIC_PATHS.privacy}>
              Privacy policy
            </a>
            <a className="comments-button comments-button--ghost" href={PUBLIC_PATHS.support}>
              Support
            </a>
            <a className="comments-button comments-button--ghost" href={PUBLIC_PATHS.account}>
              Account page
            </a>
          </div>
        </article>

        <AccountDeletionPanel onDeleted={onAccountDeleted} />
      </div>
    </section>
  )
}
