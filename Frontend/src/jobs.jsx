import { useEffect, useState } from 'react'

export default function JobsList({ currentUser }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [modalError, setModalError] = useState('')
  const [isSavingComments, setIsSavingComments] = useState(false)

  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      setJobs([])
      setError('Please log in to view your jobs.')
      return
    }
    fetchJobs()
  }, [currentUser])

  const fetchJobs = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/jobs?userId=${encodeURIComponent(currentUser?.id)}`
      )
      if (!res.ok) throw new Error('Failed to fetch jobs')
      const data = await res.json()
      setJobs(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching jobs:', err)
      setError('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:5000/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!res.ok) throw new Error('Failed to update status')

      setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, status: newStatus } : job)))
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Failed to update job status')
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getCommentPreview = (text) => {
    if (!text) return 'No notes yet'
    const cleaned = text.replace(/\s+/g, ' ').trim()
    if (!cleaned) return 'No notes yet'
    return cleaned.length > 70 ? `${cleaned.slice(0, 70)}...` : cleaned
  }

  const openCommentsModal = (job) => {
    setSelectedJob(job)
    setCommentDraft(job.comments || '')
    setModalError('')
  }

  const closeCommentsModal = () => {
    setSelectedJob(null)
    setCommentDraft('')
    setModalError('')
  }

  const saveComments = async () => {
    if (!selectedJob) return
    setIsSavingComments(true)
    setModalError('')

    try {
      const res = await fetch(`http://localhost:5000/jobs/${selectedJob.id}/comments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comments: commentDraft })
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save notes')
      }

      setJobs((prev) =>
        prev.map((job) =>
          job.id === selectedJob.id ? { ...job, comments: commentDraft } : job
        )
      )
      closeCommentsModal()
    } catch (err) {
      console.error('Error saving comments:', err)
      setModalError(err.message || 'Unable to save notes')
    } finally {
      setIsSavingComments(false)
    }
  }

  if (loading) {
    return (
      <div className="jobs-page">
        <div className="jobs-state-card">
          <div>
            <h3>Loading jobs...</h3>
            <p>We are gathering your appointment data now.</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="jobs-page">
        <div className="jobs-state-card">
          <div>
            <h3 className="jobs-error">Unable to show jobs</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="jobs-page">
      <div className="jobs-toolbar">
        <div>
          <h3>All jobs</h3>
          <p>Track schedules, update statuses, and keep every note attached to the right appointment.</p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="jobs-empty-state">
          <div>
            <h3>No jobs found</h3>
            <p>Create your first appointment to start building out the dashboard.</p>
          </div>
        </div>
      ) : (
        <div className="jobs-table-wrap">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Job Type</th>
                <th>Client</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Status</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{formatDate(job.job_date)}</td>
                  <td>{job.job_type}</td>
                  <td>{job.name}</td>
                  <td>{job.phone}</td>
                  <td>{job.address}</td>
                  <td>
                    <select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job.id, e.target.value)}
                      className="jobs-status-select"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>
                    <div className="comments-cell">
                      <button
                        type="button"
                        className="comments-button"
                        onClick={() => openCommentsModal(job)}
                      >
                        {job.comments ? 'View / edit notes' : 'Add notes'}
                      </button>
                      <p className="comments-preview">{getCommentPreview(job.comments)}</p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            {modalError && <p className="comments-modal-error">{modalError}</p>}
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
                {isSavingComments ? 'Saving...' : 'Save notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
