import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import JobForm from "./JobForm";
import JobsList from "./jobs";
import ClientsList from "./clients";
import LoginPage from './LoginPage';

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const [currentUser, setCurrentUser] = useState(null)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isLogin = location.pathname === '/'

  const handleLogout = () => {
    setCurrentUser(null)
    setShowLogoutMenu(false)
    navigate('/')
  }

  return (
    <div>
      <header className="app-header">
        <h1>Appointment Assistant</h1>
      </header>
      {!isLogin && (
        <nav className="primary-nav">
          <div className="primary-nav-links">
            <Link to="/jobs/new" className="primary-link">
              New Job
            </Link>
            <Link to="/jobs" className="primary-link">
              View Jobs
            </Link>
            <Link to="/clients" className="primary-link">
              Clients
            </Link>
          </div>
          <div className="primary-nav-meta">
            {currentUser ? (
              <div className="user-menu-container">
                <button
                  className="user-email-button"
                  onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                >
                  {currentUser.email}
                </button>
                {showLogoutMenu && (
                  <div className="logout-dropdown">
                    <button
                      className="logout-button"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/" className="primary-link">
                Login
              </Link>
            )}
          </div>
        </nav>
      )}
      <Routes>
        <Route path="/" element={<LoginPage onLogin={setCurrentUser} />} />
        <Route path="/jobs/new" element={<JobForm currentUser={currentUser} />} />
        <Route path="/jobs" element={<JobsList currentUser={currentUser} />} />
        <Route path="/clients" element={<ClientsList />} />
      </Routes>
    </div>
  )
}

export default App;
