import { useApi } from './apiContext'
import { useCallback, useEffect, useMemo, useState } from 'react'
import JobEditorModal from './JobEditorModal'
import { buildClients } from './clientUtils'
import { formatDisplayDate } from './dateUtils'
import useJobTypes from './useJobTypes'

export default function JobsList({ currentUser }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [modalError, setModalError] = useState('')
  const [isSavingComments, setIsSavingComments] = useState(false)
  const [paymentErrors, setPaymentErrors] = useState({})
  const [savingPayments, setSavingPayments] = useState({})
  const [editingJob, setEditingJob] = useState(null)
  const [isSavingJob, setIsSavingJob] = useState(false)
  const [isDeletingJob, setIsDeletingJob] = useState(false)
  const [editError, setEditError] = useState('')
  const { fetchWithAuth } = useApi()
  const { jobTypes, refreshJobTypes } = useJobTypes(currentUser)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/jobs')
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
  }, [fetchWithAuth])

  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      setJobs([])
      setError('Please log in to view your jobs.')
      return
    }
    fetchJobs()
  }, [currentUser, fetchJobs])

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      const res = await fetchWithAuth(`/jobs/${jobId}`, {
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

  const handlePaymentChange = (jobId, nextValue) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, payment: nextValue } : job))
    )
    setPaymentErrors((prev) => ({ ...prev, [jobId]: '' }))
  }

  const handlePaymentSave = async (jobId, value) => {
    if (savingPayments[jobId]) return

    const normalizedValue = value === '' ? '0' : String(value)

    if (!/^\d+(\.\d{0,2})?$/.test(normalizedValue)) {
      setPaymentErrors((prev) => ({ ...prev, [jobId]: 'Use a valid amount with up to 2 decimals' }))
      return
    }

    try {
      setSavingPayments((prev) => ({ ...prev, [jobId]: true }))
      const numericPayment = Number(normalizedValue)
      const res = await fetchWithAuth(`/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payment: numericPayment })
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to update payment')
      }

      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId ? { ...job, payment: numericPayment.toFixed(2) } : job
        )
      )
      setPaymentErrors((prev) => ({ ...prev, [jobId]: '' }))
    } catch (err) {
      console.error('Error updating payment:', err)
      setPaymentErrors((prev) => ({ ...prev, [jobId]: err.message || 'Failed to update payment' }))
    } finally {
      setSavingPayments((prev) => ({ ...prev, [jobId]: false }))
    }
  }

  const handlePaymentKeyDown = async (event, jobId) => {
    if (event.key !== 'Enter') return

    event.preventDefault()
    await handlePaymentSave(jobId, event.currentTarget.value)
  }

  const formatDate = (dateString) =>
    formatDisplayDate(dateString, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })

  const formatTimeRange = (timeValue) => {
    if (!timeValue) return '-'
    const [hoursText = '0', minutesText = '00'] = String(timeValue).split(':')
    const hours = Number(hoursText)
    const minutes = Number(minutesText)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return '-'

    const start = new Date(2000, 0, 1, hours, minutes)
    const end = new Date(2000, 0, 1, hours + 1, minutes)

    return `${start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })} - ${end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })}`
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Number(value) || 0)

  const getCommentPreview = (text) => {
    if (!text) return 'No notes yet'
    const cleaned = text.replace(/\s+/g, ' ').trim()
    if (!cleaned) return 'No notes yet'
    return cleaned.length > 100 ? `${cleaned.slice(0, 100)}...` : cleaned
  }

  const totalPayments = useMemo(
    () =>
      jobs.reduce((sum, job) => sum + (Number.parseFloat(job.payment) || 0), 0),
    [jobs]
  )
  const clients = useMemo(() => buildClients(jobs), [jobs])

  const openCommentsModal = (job) => {
    setSelectedJob(job)
    setCommentDraft(job.comments || '')
    setModalError('')
  }

  const openEditModal = (job) => {
    setEditingJob(job)
    setEditError('')
  }

  const closeCommentsModal = () => {
    setSelectedJob(null)
    setCommentDraft('')
    setModalError('')
  }

  const closeEditModal = () => {
    setEditingJob(null)
    setEditError('')
  }

  const applyJobUpdate = (jobId, updates) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== jobId) return job
        return {
          ...job,
          ...updates,
          payment:
            updates.payment !== undefined
              ? Number(updates.payment).toFixed(2)
              : job.payment,
          comments:
            updates.comments !== undefined
              ? updates.comments || null
              : job.comments
        }
      })
    )
  }

  const removeJob = (jobId) => {
    setJobs((prev) => prev.filter((job) => job.id !== jobId))
    setSelectedJob((current) => (current?.id === jobId ? null : current))
    setEditingJob((current) => (current?.id === jobId ? null : current))
  }

  const saveComments = async () => {
    if (!selectedJob) return
    setIsSavingComments(true)
    setModalError('')

    try {
      const res = await fetchWithAuth(`/jobs/${selectedJob.id}/comments`, {
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

  const saveJobEdits = async (updates) => {
    if (!editingJob) return

    setIsSavingJob(true)
    setEditError('')

    try {
      const res = await fetchWithAuth(`/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || payload.errors?.[0]?.msg || 'Failed to update job')
      }

      applyJobUpdate(editingJob.id, {
        name: updates.name,
        phone: updates.phone,
        address: updates.address,
        job_type: updates.jobType,
        job_date: updates.jobDate,
        start_time: updates.startTime,
        status: updates.status,
        payment: updates.payment,
        comments: updates.comments
      })
      await refreshJobTypes()
      closeEditModal()
    } catch (err) {
      console.error('Error updating job:', err)
      setEditError(err.message || 'Unable to update job')
    } finally {
      setIsSavingJob(false)
    }
  }

  const deleteJob = async (job) => {
    if (!job) return

    const confirmed = window.confirm(
      `Delete the ${job.job_type} job for ${job.name}? This cannot be undone.`
    )
    if (!confirmed) return

    setIsDeletingJob(true)
    setEditError('')
    setModalError('')

    try {
      const res = await fetchWithAuth(`/jobs/${job.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || payload.errors?.[0]?.msg || 'Failed to delete job')
      }

      removeJob(job.id)
    } catch (err) {
      console.error('Error deleting job:', err)
      const message = err.message || 'Unable to delete job'
      if (editingJob?.id === job.id) {
        setEditError(message)
      } else {
        setModalError(message)
      }
    } finally {
      setIsDeletingJob(false)
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
          <p>Track schedules, update statuses, payment amounts, and keep every note attached to the right appointment.</p>
        </div>
        <div className="jobs-payments-summary">
          <span className="jobs-payments-summary-label">Total payments</span>
          <strong>{formatCurrency(totalPayments)}</strong>
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
                <th>Time</th>
                <th>Job Type</th>
                <th>Client</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Comments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{formatDate(job.job_date)}</td>
                  <td>{formatTimeRange(job.start_time)}</td>
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
                    <div className="jobs-payment-cell">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="jobs-payment-input"
                        value={job.payment ?? ''}
                        onChange={(e) => handlePaymentChange(job.id, e.target.value)}
                        onKeyDown={(e) => handlePaymentKeyDown(e, job.id)}
                        onBlur={(e) => handlePaymentSave(job.id, e.target.value)}
                        disabled={Boolean(savingPayments[job.id])}
                      />
                      {savingPayments[job.id] && (
                        <p className="jobs-payment-status">Saving...</p>
                      )}
                      {paymentErrors[job.id] && (
                        <p className="jobs-payment-error">{paymentErrors[job.id]}</p>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="comments-cell">
                      <button
                        type="button"
                        className="comments-button"
                        onClick={() => openCommentsModal(job)}
                      >
                        {job.comments ? 'edit' : 'Add notes'}
                      </button>
                      <p className="comments-preview">{getCommentPreview(job.comments)}</p>
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="comments-button"
                        onClick={() => openEditModal(job)}
                      >
                        Edit job
                      </button>
                      <button
                        type="button"
                        className="comments-button comments-button--danger"
                        onClick={() => deleteJob(job)}
                        disabled={isDeletingJob}
                      >
                        Delete
                      </button>
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

      <JobEditorModal
        key={editingJob?.id || 'jobs-editor'}
        job={editingJob}
        clients={clients}
        jobTypes={jobTypes}
        saving={isSavingJob}
        deleting={isDeletingJob}
        error={editError}
        onClose={closeEditModal}
        onSave={saveJobEdits}
        onDelete={deleteJob}
      />
    </div>
  )
}
