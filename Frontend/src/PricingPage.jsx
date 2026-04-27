import { Link } from 'react-router-dom'
import MarketingNav from './MarketingNav'
import { APP_PATHS, PUBLIC_PATHS } from './appInfo'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    description: 'Best for trying the workflow and getting a small operation organized.',
    limits: '10 new clients, 25 new jobs, and 4 custom job types',
    features: ['1 user', 'Calendar, clients, jobs, and notes', 'Desktop and mobile access']
  },
  {
    name: 'Starter',
    price: '$14.99/mo',
    description: 'Good for solo operators who need unlimited records and custom job types.',
    limits: 'Unlimited clients and jobs',
    features: ['1 user', 'Unlimited custom job types and colors', 'Billing-ready upgrade path']
  },
  {
    name: 'Team',
    price: '$39.99/mo',
    description: 'Built for small teams that need shared scheduling and more user capacity.',
    limits: 'Unlimited clients and jobs',
    features: ['Up to 5 users', 'Shared workspace scheduling', 'Mobile and desktop coordination']
  }
]

export default function PricingPage({ currentUser }) {
  return (
    <div className="landing-page">
      <MarketingNav currentUser={currentUser} />

      <section className="landing-section">
        <div className="landing-section__header">
          <p className="sidebar-eyebrow">Pricing</p>
          <h1>Start free, then upgrade when your volume and team size justify it.</h1>
          <p>
            The pricing model is designed so new businesses can try the full scheduling workflow before committing, while growing teams can move into unlimited record creation as they scale.
          </p>
        </div>
        <div className="landing-feature-grid">
          {PLANS.map((plan) => (
            <article key={plan.name} className="landing-feature-card">
              <p className="sidebar-eyebrow">{plan.name}</p>
              <h3>{plan.price}</h3>
              <p>{plan.description}</p>
              <strong className="landing-pricing-card__limit">{plan.limits}</strong>
              <ul className="landing-pricing-card__list">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section__header">
          <p className="sidebar-eyebrow">Useful context</p>
          <h2>What a new user should know</h2>
        </div>
        <div className="landing-steps">
          <article className="landing-step-card">
            <span className="landing-step-card__number">01</span>
            <h3>The free plan is real</h3>
            <p>You can create accounts, use the workflow, and test the experience before deciding if unlimited records are worth it for your business.</p>
          </article>
          <article className="landing-step-card">
            <span className="landing-step-card__number">02</span>
            <h3>Upgrade only when needed</h3>
            <p>The billing experience already shows usage, reset timing, and the path to move into a paid plan when you outgrow the free tier.</p>
          </article>
          <article className="landing-step-card">
            <span className="landing-step-card__number">03</span>
            <h3>Use the same product everywhere</h3>
            <p>Desktop and mobile stay aligned, so the product scales with the way the office and field teams actually work together.</p>
          </article>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="sidebar-eyebrow">Get started</p>
          <h2>Use the free plan first, then upgrade when the workflow proves itself.</h2>
          <p>That keeps adoption simple and gives you a pricing page that is easy to understand for new visitors.</p>
        </div>
        <div className="landing-cta__actions">
          <Link className="sidebar-primary-action landing-primary-cta" to={PUBLIC_PATHS.signup}>
            <span className="sidebar-primary-action-icon">+</span>
            Start Free
          </Link>
          <Link className="sidebar-secondary-action landing-secondary-cta" to={currentUser ? APP_PATHS.billing : PUBLIC_PATHS.login}>
            {currentUser ? 'Open Billing' : 'Login'}
          </Link>
        </div>
      </section>
    </div>
  )
}
