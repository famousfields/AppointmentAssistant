import { Link } from 'react-router-dom'
import MarketingNav from './MarketingNav'
import { APP_PATHS, PUBLIC_PATHS } from './appInfo'

const FEATURE_BLOCKS = [
  {
    title: 'Calendar views that keep the whole team aligned',
    body: 'Switch between daily, weekly, monthly, and yearly scheduling views so office staff and field crews can see exactly what is booked and what is still open.'
  },
  {
    title: 'Client records connected to every job',
    body: 'Customer contact details, addresses, pricing, notes, and job history stay tied together so you do not have to reconstruct context from scattered messages.'
  },
  {
    title: 'Fast job capture workflow',
    body: 'Create a work order in a few steps with client details, scheduling, payment amount, and dispatch notes so the team can act on it right away.'
  },
  {
    title: 'Mobile access for the field',
    body: 'Use the mobile client to review the day, capture new work, and keep the schedule updated when the team is away from the desk.'
  },
  {
    title: 'Usage-aware billing and upgrade path',
    body: 'Start free, monitor monthly job and client creation limits, and upgrade when your volume outgrows the free plan.'
  },
  {
    title: 'Privacy, support, and account controls',
    body: 'Built-in pages for privacy, support, billing, and account management make the product easier to trust and easier to operate.'
  }
]

export default function FeaturesPage({ currentUser }) {
  return (
    <div className="landing-page">
      <MarketingNav currentUser={currentUser} />

      <section className="landing-section">
        <div className="landing-section__header">
          <p className="sidebar-eyebrow">Features</p>
          <h1>Everything in the product is designed to help service businesses book work faster and run cleaner days.</h1>
          <p>
            Appointment Assistant focuses on the practical workflow: capture the customer, schedule the job, keep the calendar accurate, and give the team enough context to deliver the work without guesswork.
          </p>
        </div>
        <div className="landing-feature-grid">
          {FEATURE_BLOCKS.map((feature) => (
            <article key={feature.title} className="landing-feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section__header">
          <p className="sidebar-eyebrow">Operational impact</p>
          <h2>Why these features matter</h2>
        </div>
        <div className="landing-steps">
          <article className="landing-step-card">
            <span className="landing-step-card__number">01</span>
            <h3>Less context switching</h3>
            <p>Keep jobs, clients, revenue, and notes inside one workspace instead of spreading them across spreadsheets, text threads, and sticky notes.</p>
          </article>
          <article className="landing-step-card">
            <span className="landing-step-card__number">02</span>
            <h3>Clearer dispatching</h3>
            <p>Every appointment can include the address, timing, notes, and pricing details the crew needs before leaving for the job.</p>
          </article>
          <article className="landing-step-card">
            <span className="landing-step-card__number">03</span>
            <h3>Better follow-through</h3>
            <p>When the schedule and the customer history are easy to review, missed follow-ups and duplicate data entry become much easier to avoid.</p>
          </article>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="sidebar-eyebrow">Next step</p>
          <h2>Explore pricing or start using the app.</h2>
          <p>Use the free plan to test the workflow, or go straight into the product if you already have an account.</p>
        </div>
        <div className="landing-cta__actions">
          <Link className="sidebar-primary-action landing-primary-cta" to={PUBLIC_PATHS.pricing}>
            <span className="sidebar-primary-action-icon">$</span>
            View Pricing
          </Link>
          <Link className="sidebar-secondary-action landing-secondary-cta" to={currentUser ? APP_PATHS.dashboard : PUBLIC_PATHS.signup}>
            {currentUser ? 'Open App' : 'Create Account'}
          </Link>
        </div>
      </section>
    </div>
  )
}
