import { Link } from 'react-router-dom'
import MarketingNav from './MarketingNav'
import { APP_PATHS, GOOGLE_PLAY_URL, PUBLIC_PATHS } from './appInfo'

const FEATURE_CARDS = [
  {
    eyebrow: 'Scheduling',
    title: 'See the entire day without the chaos',
    body: 'Daily, weekly, monthly, and yearly views keep every appointment, revenue target, and gap in the schedule easy to spot.'
  },
  {
    eyebrow: 'Clients',
    title: 'Keep every customer detail attached to the job',
    body: 'Phone numbers, addresses, notes, payment details, and job history stay in one workspace instead of getting lost in texts.'
  },
  {
    eyebrow: 'Mobile',
    title: 'Create work orders from the field or the office',
    body: 'The mobile client mirrors the core workflow so crews can capture jobs, review schedules, and stay coordinated on the go.'
  }
]

const BENEFITS = [
  'Start on the free plan with room for 10 new clients and 25 new jobs every month.',
  'Track quoted revenue, job status, comments, and dispatch notes in one place.',
  'Use the same workflow across desktop and mobile so nothing needs to be re-entered.'
]

const STEPS = [
  {
    title: 'Capture the customer',
    body: 'Create the client, confirm the address, and keep the visit tied to the right contact record.'
  },
  {
    title: 'Book the work',
    body: 'Assign the date, time, job type, and price so the office and the crew see the same schedule.'
  },
  {
    title: 'Run the day',
    body: 'Review appointments, update notes, and keep the calendar accurate as the work gets done.'
  }
]

export default function LandingScreen({ currentUser }) {
  const playStoreReady = Boolean(GOOGLE_PLAY_URL)

  return (
    <div className="landing-page">
      <MarketingNav currentUser={currentUser} />

      <section className="landing-hero">
        <div className="landing-hero__content">
          <div className="landing-brand">
            <div className="landing-brand__mark">AA</div>
            <div>
              <p className="sidebar-eyebrow">Scheduling software for service teams</p>
              <h1>Appointment Assistant keeps jobs, clients, and daily scheduling in one clean system.</h1>
            </div>
          </div>
          <p className="landing-hero__copy">
            Replace scattered notes, missed callbacks, and manual follow-up with a workspace built for booking work fast, keeping crews informed, and staying on top of the calendar from desktop or mobile.
          </p>
          <div className="landing-hero__actions">
            <Link className="sidebar-primary-action landing-primary-cta" to={PUBLIC_PATHS.signup}>
              <span className="sidebar-primary-action-icon">+</span>
              Try The Free Plan
            </Link>
            <Link className="sidebar-secondary-action landing-secondary-cta" to={PUBLIC_PATHS.login}>
              Sign in
            </Link>
          </div>
          <div className="landing-download-row">
            <a
              className={`landing-download-card${playStoreReady ? '' : ' landing-download-card--disabled'}`}
              href={playStoreReady ? GOOGLE_PLAY_URL : undefined}
              target={playStoreReady ? '_blank' : undefined}
              rel={playStoreReady ? 'noreferrer' : undefined}
              aria-disabled={playStoreReady ? 'false' : 'true'}
            >
              <span className="landing-download-card__label">Google Play</span>
              <strong>{playStoreReady ? 'Download the Android app' : 'Add your Google Play link here'}</strong>
              <span>{playStoreReady ? 'Open the Play Store listing' : 'Set `VITE_GOOGLE_PLAY_URL` when the app listing is ready.'}</span>
            </a>
            <div className="landing-download-card landing-download-card--info">
              <span className="landing-download-card__label">Built for real operations</span>
              <strong>Start free, then upgrade only when usage grows</strong>
              <span>Useful for solo operators, office admins, and small service crews that need scheduling discipline fast.</span>
            </div>
          </div>
          <div className="landing-benefits">
            {BENEFITS.map((item) => (
              <div key={item} className="landing-benefit-pill">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="landing-hero__visual">
          <div className="landing-browser-shot">
            <div className="landing-browser-shot__bar">
              <span />
              <span />
              <span />
            </div>
            <div className="landing-browser-shot__body">
              <div className="landing-browser-shot__header">
                <div>
                  <p className="sidebar-eyebrow">Desktop workspace</p>
                  <strong>Calendar overview</strong>
                </div>
                <div className="landing-browser-shot__metric">Gross today: $1,240</div>
              </div>
              <div className="landing-calendar-preview">
                <div className="landing-calendar-preview__rail">
                  <span>8 AM</span>
                  <span>10 AM</span>
                  <span>12 PM</span>
                  <span>2 PM</span>
                  <span>4 PM</span>
                </div>
                <div className="landing-calendar-preview__grid">
                  <div className="landing-calendar-preview__job landing-calendar-preview__job--teal">
                    <strong>Spring cleanup</strong>
                    <span>9:00 AM | 14 Pine Grove Rd</span>
                  </div>
                  <div className="landing-calendar-preview__job landing-calendar-preview__job--amber">
                    <strong>Pressure wash</strong>
                    <span>12:30 PM | 88 Cedar Lane</span>
                  </div>
                  <div className="landing-calendar-preview__job landing-calendar-preview__job--blue">
                    <strong>Mower repair</strong>
                    <span>3:00 PM | 124 Wilson Ave</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-phone-stack">
            <div className="landing-phone-shot">
              <div className="landing-phone-shot__screen">
                <p className="sidebar-eyebrow">Mobile app</p>
                <strong>Appointments for the day</strong>
                <div className="landing-phone-shot__chips">
                  <span>Previous</span>
                  <span className="landing-phone-shot__chips--active">Today</span>
                  <span>Next</span>
                </div>
                <div className="landing-phone-shot__card">
                  <h3>0 scheduled jobs</h3>
                  <p>No jobs scheduled for this day.</p>
                </div>
              </div>
            </div>
            <div className="landing-phone-shot landing-phone-shot--offset">
              <div className="landing-phone-shot__screen">
                <p className="sidebar-eyebrow">Quick job capture</p>
                <strong>New work order</strong>
                <div className="landing-form-preview">
                  <span>Client name</span>
                  <span>Phone</span>
                  <span>Address</span>
                  <span>Job type</span>
                </div>
                <div className="landing-phone-shot__button">Create Job</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section__header">
          <p className="sidebar-eyebrow">Why teams use it</p>
          <h2>Everything needed to go from inbound lead to scheduled appointment</h2>
          <p>
            Appointment Assistant is built for service businesses that need scheduling clarity, better customer records, and a faster way to capture work without juggling multiple tools.
          </p>
        </div>
        <div className="landing-feature-grid">
          {FEATURE_CARDS.map((feature) => (
            <article key={feature.title} className="landing-feature-card">
              <p className="sidebar-eyebrow">{feature.eyebrow}</p>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section__header">
          <p className="sidebar-eyebrow">How it works</p>
          <h2>A simple workflow that fits the way service businesses already operate</h2>
        </div>
        <div className="landing-steps">
          {STEPS.map((step, index) => (
            <article key={step.title} className="landing-step-card">
              <span className="landing-step-card__number">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="sidebar-eyebrow">Ready to try it?</p>
          <h2>Start on the free plan and see if the workflow fits your business.</h2>
          <p>
            You can use the web app immediately, keep the billing page ready for upgrades, and plug in the Google Play link as soon as the Android listing is approved.
          </p>
        </div>
        <div className="landing-cta__actions">
          <Link className="sidebar-primary-action landing-primary-cta" to={PUBLIC_PATHS.signup}>
            <span className="sidebar-primary-action-icon">+</span>
            Create Free Account
          </Link>
          <Link className="sidebar-secondary-action landing-secondary-cta" to={PUBLIC_PATHS.login}>
            Open Sign In
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <p>Useful links</p>
        <div className="landing-footer__links">
          <a href={PUBLIC_PATHS.privacy}>Privacy policy</a>
          <a href={PUBLIC_PATHS.support}>Support</a>
          <a href={PUBLIC_PATHS.account}>Account management</a>
        </div>
        {currentUser ? <Link to={APP_PATHS.dashboard}>Go to your workspace</Link> : null}
      </footer>
    </div>
  )
}
