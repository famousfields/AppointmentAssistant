import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  const isLogin = location.pathname === '/'

  return (
    <div>
      <header className="app-header">
        <h1>Appointment Assistant</h1>
        {!isLogin && (
          <Link to="/" className="primary-link">
            Login
          </Link>
        )}
      </header>
      {!isLogin && (
        <nav className="primary-nav">
          <Link to="/jobs/new" className="primary-link">
            New Job
          </Link>
          <Link to="/jobs" className="primary-link">
            View Jobs
          </Link>
          <Link to="/clients" className="primary-link">
            Clients
          </Link>
        </nav>
      )}
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/jobs/new" element={<JobForm />} />
        <Route path="/jobs" element={<JobsList />} />
        <Route path="/clients" element={<ClientsList />} />
      </Routes>
    </div>
  )
}

export default App;
