import { useApi } from './apiContext'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import JobEditorModal from './JobEditorModal'
import { buildClients } from './clientUtils'
import { formatDisplayDate } from './dateUtils'
import useJobTypes from './useJobTypes'
import {
  EmptyState,
  JobStatusChips,
  MetricCard,
  SectionCard
} from './productUi'

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']

const formatDate = (dateString) =>
  formatDisplayDate(dateString, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

const formatTimeRange = (timeValue) => {
  if (!timeValue) return 'Time not set'
  const [hoursText = '0', minutesText = '00'] = String(timeValue).split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 'Time not set'

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
  return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned
}

const sortJobsBySchedule = (jobs) =>
  [...jobs].sort((first, second) => {
    const firstDate = new Date(`${first.job_date}T${first.start_time || '23:59:59'}`).getTime()
    const secondDate = new Date(`${second.job_date}T${second.start_time || '23:59:59'}`).getTime()
    return firstDate - secondDate
  })

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
  const navigate = useNavigate()

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/jobs')
      if (!response.ok) throw new Error('Failed to fetch jobs')
      const data = await response.json()
      setJobs(sortJobsBySchedule(data))
      setError(null)
    } catch (fetchError) {
      console.error('Error fetching jobs:', fetchError)
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
      const response = await fetchWithAuth(`/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) throw new Error('Failed to update status')

      setJobs((prev) =>
        sortJobsBySchedule(prev.map((job) => (job.id === jobId ? { ...job, status: newStatus } : job)))
      )
      setSelectedJob((current) =>
        current?.id === jobId ? { ...current, status: newStatus } : current
      )
    } catch (updateError) {
      console.error('Error updating status:', updateError)
      alert('Failed to update job status')
    }
  }

  const handlePaymentChange = (jobId, nextValue) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, payment: nextValue } : job))
    )
    setSelectedJob((current) =>
      current?.id === jobId ? { ...current, payment: nextValue } : current
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
      const response = await fetchWithAuth(`/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payment: numericPayment })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to update payment')
      }

      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId ? { ...job, payment: numericPayment.toFixed(2) } : job
        )
      )
      setSelectedJob((current) =>
        current?.id === jobId ? { ...current, payment: numericPayment.toFixed(2) } : current
      )
      setPaymentErrors((prev) => ({ ...prev, [jobId]: '' }))
    } catch (paymentError) {
      console.error('Error updating payment:', paymentError)
      setPaymentErrors((prev) => ({ ...prev, [jobId]: paymentError.message || 'Failed to update payment' }))
    } finally {
      setSavingPayments((prev) => ({ ...prev, [jobId]: false }))
    }
  }

  const handlePaymentKeyDown = async (event, jobId) => {
    if (event.key !== 'Enter') return

    event.preventDefault()
    await handlePaymentSave(jobId, event.currentTarget.value)
  }

  const totalPayments = useMemo(
    () => jobs.reduce((sum, job) => sum + (Number.parseFloat(job.payment) || 0), 0),
    [jobs]
  )
  const clients = useMemo(() => buildClients(jobs), [jobs])

  const dashboardMetrics = useMemo(() => {
    const scheduled = jobs.filter((job) => job.status === 'Pending').length
    const inProgress = jobs.filter((job) => job.status === 'In Progress').length
    const completed = jobs.filter((job) => job.status === 'Completed').length
    const attention = jobs.filter((job) => !job.start_time || !job.address || !job.phone).length

    return { scheduled, inProgress, completed, attention }
  }, [jobs])

  const openNotesModal = (job) => {
    setSelectedJob(job)
    setCommentDraft(job.comments || '')
    setModalError('')
  }

  const openJobCommandCenter = (job) => {
    setSelectedJob(job)
    setCommentDraft(job.comments || '')
    setModalError('')
  }

  const openEditModal = (job) => {
    setEditingJob(job)
    setEditError('')
  }

  const closeSelectedJob = () => {
    setSelectedJob(null)
    setCommentDraft('')
    setModalError('')
  }

  const closeEditModal = () => {
    setEditingJob(null)
    setEditError('')
  }

  const applyJobUpdate = (jobId, updates) => {
    const normalizePayment = (value, fallback) =>
      value !== undefined ? Number(value).toFixed(2) : fallback

    const normalizeComments = (value, fallback) =>
      value !== undefined ? value || null : fallback

    setJobs((prev) =>
      sortJobsBySchedule(
        prev.map((job) => {
          if (job.id !== jobId) return job
          return {
            ...job,
            ...updates,
            payment: normalizePayment(updates.payment, job.payment),
            comments: normalizeComments(updates.comments, job.comments)
          }
        })
      )
    )

    setSelectedJob((current) => {
      if (!current || current.id !== jobId) return current
      return {
        ...current,
        ...updates,
        payment: normalizePayment(updates.payment, current.payment),
        comments: normalizeComments(updates.comments, current.comments)
      }
    })
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
      const response = await fetchWithAuth(`/jobs/${selectedJob.id}/comments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comments: commentDraft })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save notes')
      }

      applyJobUpdate(selectedJob.id, { comments: commentDraft })
      closeSelectedJob()
    } catch (saveError) {
      console.error('Error saving comments:', saveError)
      setModalError(saveError.message || 'Unable to save notes')
    } finally {
      setIsSavingComments(false)
    }
  }

  const saveJobEdits = async (updates) => {
    if (!editingJob) return

    setIsSavingJob(true)
    setEditError('')

    try {
      const response = await fetchWithAuth(`/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
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
    } catch (saveError) {
      console.error('Error updating job:', saveError)
      setEditError(saveError.message || 'Unable to update job')
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
      const response = await fetchWithAuth(`/jobs/${job.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || payload.errors?.[0]?.msg || 'Failed to delete job')
      }

      removeJob(job.id)
    } catch (deleteError) {
      console.error('Error deleting job:', deleteError)
      const message = deleteError.message || 'Unable to delete job'
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
      <SectionCard
        eyebrow="Operations Dashboard"
        title="Today’s jobs and next actions"
        description="Keep dispatch, field progress, and payment follow-up in one operational view."
        action={
          <button type="button" className="sidebar-primary-action jobs-hero-action" onClick={() => navigate('/jobs/new')}>
            <span className="sidebar-primary-action-icon">+</span>
            New Job
          </button>
        }
        className="jobs-hero-card"
      >
        <div className="metric-card-grid">
          <MetricCard label="Scheduled" value={dashboardMetrics.scheduled} helper="Ready to dispatch" tone="accent" />
          <MetricCard label="In progress" value={dashboardMetrics.inProgress} helper="Technician active" />
          <MetricCard label="Completed" value={dashboardMetrics.completed} helper="Ready for wrap-up" tone="success" />
          <MetricCard label="Payments tracked" value={formatCurrency(totalPayments)} helper={`${clients.length} clients in workspace`} />
        </div>
      </SectionCard>

      {dashboardMetrics.attention > 0 ? (
        <div className="jobs-attention-banner">
          <strong>{dashboardMetrics.attention} jobs need cleaner dispatch info.</strong>
          <span>Missing times, phone numbers, or service addresses slow down the office and the field.</span>
        </div>
      ) : null}

      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Create your first work order to start building a schedule, client history, and payment pipeline."
          action={
            <button type="button" className="form-submit-button" onClick={() => navigate('/jobs/new')}>
              Create first job
            </button>
          }
        />
      ) : (
        <div className="job-work-list">
          {jobs.map((job) => (
            <article key={job.id} className="job-work-card">
              <div className="job-work-card__header">
                <div>
                  <p className="job-work-card__eyebrow">{formatDate(job.job_date)} | {formatTimeRange(job.start_time)}</p>
                  <h3>{job.name}</h3>
                  <p className="job-work-card__subcopy">{job.job_type} at {job.address || 'Address needed'}</p>
                </div>
                <JobStatusChips job={job} />
              </div>

              <div className="job-work-card__grid">
                <div className="job-work-card__detail">
                  <span>Client</span>
                  <strong>{job.phone || 'Phone needed'}</strong>
                </div>
                <div className="job-work-card__detail">
                  <span>Quoted amount</span>
                  <strong>{formatCurrency(job.payment)}</strong>
                </div>
                <div className="job-work-card__detail">
                  <span>Dispatch notes</span>
                  <strong>{getCommentPreview(job.comments)}</strong>
                </div>
              </div>

              <div className="job-work-card__controls">
                <div className="job-work-card__field">
                  <label htmlFor={`status-${job.id}`}>Status</label>
                  <select
                    id={`status-${job.id}`}
                    value={job.status}
                    onChange={(event) => handleStatusChange(job.id, event.target.value)}
                    className="jobs-status-select"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="job-work-card__field">
                  <label htmlFor={`payment-${job.id}`}>Payment</label>
                  <input
                    id={`payment-${job.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    className="jobs-payment-input"
                    value={job.payment ?? ''}
                    onChange={(event) => handlePaymentChange(job.id, event.target.value)}
                    onKeyDown={(event) => handlePaymentKeyDown(event, job.id)}
                    onBlur={(event) => handlePaymentSave(job.id, event.target.value)}
                    disabled={Boolean(savingPayments[job.id])}
                  />
                  {savingPayments[job.id] ? <p className="jobs-payment-status">Saving...</p> : null}
                  {paymentErrors[job.id] ? <p className="jobs-payment-error">{paymentErrors[job.id]}</p> : null}
                </div>

                <div className="job-work-card__actions">
                  <button
                    type="button"
                    className="comments-button"
                    onClick={() => openJobCommandCenter(job)}
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    className="comments-button comments-button--ghost"
                    onClick={() => openNotesModal(job)}
                  >
                    Edit notes
                  </button>
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
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedJob && (
        <div className="comments-modal-backdrop" onClick={closeSelectedJob}>
          <div className="comments-modal job-command-modal" onClick={(event) => event.stopPropagation()}>
            <div className="comments-modal-header job-command-modal__header">
              <div>
                <p className="section-card__eyebrow">Job Command Center</p>
                <h3>{selectedJob.name}</h3>
                <p className="comments-modal-subtitle">
                  {formatDate(selectedJob.job_date)} | {formatTimeRange(selectedJob.start_time)}
                </p>
              </div>
              <JobStatusChips job={selectedJob} />
            </div>

            <div className="job-command-grid">
              <SectionCard eyebrow="Client" title="Contact" compact>
                <div className="job-command-list">
                  <div className="job-command-list__item">
                    <span>Phone</span>
                    <strong>{selectedJob.phone || 'Missing phone number'}</strong>
                  </div>
                  <div className="job-command-list__item">
                    <span>Address</span>
                    <strong>{selectedJob.address || 'Missing address'}</strong>
                  </div>
                </div>
              </SectionCard>

              <SectionCard eyebrow="Scope" title="Work order" compact>
                <div className="job-command-list">
                  <div className="job-command-list__item">
                    <span>Job type</span>
                    <strong>{selectedJob.job_type || 'Not set'}</strong>
                  </div>
                  <div className="job-command-list__item">
                    <span>Payment tracked</span>
                    <strong>{formatCurrency(selectedJob.payment)}</strong>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                eyebrow="Notes"
                title="Dispatch details"
                description="Keep comments practical enough for the next office handoff or field visit."
                compact
                className="job-command-grid__full"
              >
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Add or update notes about this job (500 characters max)"
                />
                {modalError && <p className="comments-modal-error">{modalError}</p>}
              </SectionCard>
            </div>

            <div className="comments-modal-actions">
              <button
                type="button"
                className="comments-modal-button comments-modal-button--ghost"
                onClick={closeSelectedJob}
                disabled={isSavingComments}
              >
                Close
              </button>
              <button
                type="button"
                className="comments-modal-button comments-modal-button--ghost"
                onClick={() => {
                  openEditModal(selectedJob)
                  closeSelectedJob()
                }}
              >
                Edit job
              </button>
              <button
                type="button"
                className="comments-modal-button comments-modal-button--danger"
                onClick={() => deleteJob(selectedJob)}
                disabled={isDeletingJob}
              >
                {isDeletingJob ? 'Deleting...' : 'Delete job'}
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
