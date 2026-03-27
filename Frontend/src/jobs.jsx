import { useState, useEffect } from "react";

export default function JobsList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [modalError, setModalError] = useState("");
  const [isSavingComments, setIsSavingComments] = useState(false);

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

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:5000/jobs/${jobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error("Failed to update status");
      
      // Update local state
      setJobs(jobs.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      ));
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update job status");
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

  const getCommentPreview = (text) => {
    if (!text) return "No notes yet";
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return "No notes yet";
    return cleaned.length > 70 ? `${cleaned.slice(0, 70)}...` : cleaned;
  };

  const openCommentsModal = (job) => {
    setSelectedJob(job);
    setCommentDraft(job.comments || "");
    setModalError("");
  };

  const closeCommentsModal = () => {
    setSelectedJob(null);
    setCommentDraft("");
    setModalError("");
  };

  const saveComments = async () => {
    if (!selectedJob) return;
    setIsSavingComments(true);
    setModalError("");

    try {
      const res = await fetch(`http://localhost:5000/jobs/${selectedJob.id}/comments`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ comments: commentDraft })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save notes");
      }

      setJobs((prev) =>
        prev.map((job) =>
          job.id === selectedJob.id ? { ...job, comments: commentDraft } : job
        )
      );
      closeCommentsModal();
    } catch (err) {
      console.error("Error saving comments:", err);
      setModalError(err.message || "Unable to save notes");
    } finally {
      setIsSavingComments(false);
    }
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
                <td style={{ padding: "10px" }}>
                  <select 
                    value={job.status} 
                    onChange={(e) => handleStatusChange(job.id, e.target.value)}
                    style={{
                      padding: "5px",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                      cursor: "pointer",
                      color: "black",
                      fontWeight: "600",
                      backgroundColor: job.status === "Completed" ? "#d1fae5" : job.status === "In Progress" ? "#fef3c7" : job.status === "Cancelled" ? "#fee2e2" : "#f3f4f6"
                    }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
              </select>
                </td>
                <td style={{ padding: "10px" }}>
                  <div className="comments-cell">
                    <button
                      type="button"
                      className="comments-button"
                      onClick={() => openCommentsModal(job)}
                    >
                      {job.comments ? "View / edit notes" : "Add notes"}
                    </button>
                    <p className="comments-preview">{getCommentPreview(job.comments)}</p>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedJob && (
        <div className="comments-modal-backdrop" onClick={closeCommentsModal}>
          <div className="comments-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comments-modal-header">
              <h3>Notes for {selectedJob.name}</h3>
              <p className="comments-modal-subtitle">
                {selectedJob.job_type} - {formatDate(selectedJob.job_date)}
              </p>
            </div>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Add or update notes about this job (500 characters max)"
            ></textarea>
            {modalError && (
              <p className="comments-modal-error">
                {modalError}
              </p>
            )}
            <div className="comments-modal-actions">
              <button
                type="button"
                className="comments-modal-button comments-modal-button--ghost"
                onClick={closeCommentsModal}
                disabled={isSavingComments}
              >
                Cancel
              </button>
              <button
                type="button"
                className="comments-modal-button comments-modal-button--primary"
                onClick={saveComments}
                disabled={isSavingComments}
              >
                {isSavingComments ? "Saving..." : "Save notes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
