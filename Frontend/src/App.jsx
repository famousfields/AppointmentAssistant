import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import './App.css'
import JobForm from "./JobForm";
import JobsList from "./jobs";

function App() {
  return (
    <Router>
      <div>
        <h1>Appointment Assistant</h1>
        <nav style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "20px" }}>
          <Link to="/" style={{
            padding: "10px 20px",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "600",
            cursor: "pointer"
          }}>
            New Job
          </Link>
          <Link to="/jobs" style={{
            padding: "10px 20px",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "600",
            cursor: "pointer"
          }}>
            View Jobs
          </Link>
        </nav>
        <Routes>
          <Route path="/" element={<JobForm />} />
          <Route path="/jobs" element={<JobsList />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;