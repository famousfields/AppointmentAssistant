import { Link } from 'react-router-dom'
import { APP_PATHS, PUBLIC_PATHS } from './appInfo'

export default function MarketingNav({ currentUser }) {
  return (
    <header className="marketing-nav">
      <Link className="marketing-nav__brand" to={PUBLIC_PATHS.home}>
        <span className="marketing-nav__mark">AA</span>
        <span>Appointment Assistant</span>
      </Link>

      <nav className="marketing-nav__links" aria-label="Marketing navigation">
        <Link to={PUBLIC_PATHS.features}>Features</Link>
        <Link to={PUBLIC_PATHS.pricing}>Pricing</Link>
        <Link to={PUBLIC_PATHS.login}>Login</Link>
        <Link to={PUBLIC_PATHS.signup}>Signup</Link>
      </nav>

      <div className="marketing-nav__actions">
        {currentUser ? (
          <Link className="sidebar-primary-action landing-primary-cta" to={APP_PATHS.dashboard}>
            <span className="sidebar-primary-action-icon">+</span>
            Open App
          </Link>
        ) : (
          <Link className="sidebar-primary-action landing-primary-cta" to={PUBLIC_PATHS.signup}>
            <span className="sidebar-primary-action-icon">+</span>
            Start Free
          </Link>
        )}
      </div>
    </header>
  )
}
