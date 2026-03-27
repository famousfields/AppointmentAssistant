import { useState, useEffect } from "react";

export default function JobsList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch("http://localhost:5000/jobs");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setError("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  if (loading) return <div>Loading jobs...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <div style={{ padding: "20px" }}>
      <h2>All Jobs</h2>
      {jobs.length === 0 ? (
        <p>No jobs found</p>
      ) : (
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "20px"
        }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: "10px" }}>Date</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Job Type</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Client</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Phone</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Address</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Status</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Comments</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "10px" }}>{formatDate(job.job_date)}</td>
                <td style={{ padding: "10px" }}>{job.job_type}</td>
                <td style={{ padding: "10px" }}>{job.name}</td>
                <td style={{ padding: "10px" }}>{job.phone}</td>
                <td style={{ padding: "10px" }}>{job.address}</td>
                <td style={{ padding: "10px" }}>{job.status}</td>
                <td style={{ padding: "10px" }}>{job.comments || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}