import { useApi } from './apiContext'
import { useCallback, useEffect, useMemo, useState } from 'react'
import JobEditorModal from './JobEditorModal'
import { buildClients } from './clientUtils'
import { formatDisplayDate } from './dateUtils'
import { getJobStatusMeta } from './statusUtils'
import useJobTypes from './useJobTypes'
import {
  EmptyState,
  MetricCard,
  SectionCard,
  StatusChip
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

const sortJobsBySchedule = (jobs) =>
  [...jobs].sort((first, second) => {
    const firstDate = new Date(`${first.job_date}T${first.start_time || '23:59:59'}`).getTime()
    const secondDate = new Date(`${second.job_date}T${second.start_time || '23:59:59'}`).getTime()
    return firstDate - secondDate
  })

const groupJobsByDay = (jobs) => {
  const groups = new Map()

  jobs.forEach((job) => {
    const dateKey = job.job_date || 'unscheduled'
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey).push(job)
  })

  return Array.from(groups.entries()).map(([dateKey, groupedJobs]) => ({
    dateKey,
    title: dateKey === 'unscheduled' ? 'No date assigned' : formatDate(dateKey),
    jobs: groupedJobs
  }))
}

export default function JobsList({ currentUser }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [modalError, setModalError] = useState('')
  const [isSavingComments, setIsSavingComments] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [isSavingJob, setIsSavingJob] = useState(false)
  const [isDeletingJob, setIsDeletingJob] = useState(false)
  const [editError, setEditError] = useState('')
  const { fetchWithAuth } = useApi()
  const { jobTypes, refreshJobTypes } = useJobTypes(currentUser)

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
  const jobsGroupedByDay = useMemo(() => groupJobsByDay(jobs), [jobs])

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
        />
      ) : (
        <div className="job-day-group-list">
          {jobsGroupedByDay.map((group) => (
            <section key={group.dateKey} className="job-day-group">
              <div className="job-day-group__header">
                <div>
                  <p className="job-day-group__eyebrow">Scheduled day</p>
                  <h3>{group.title}</h3>
                </div>
                <span className="job-day-group__count">
                  {group.jobs.length} job{group.jobs.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="job-work-list">
                {group.jobs.map((job) => {
                  const jobStatus = getJobStatusMeta(job.status)

                  return (
                    <article key={job.id} className="job-work-card">
                      <div className="job-work-card__status">
                        <StatusChip tone={jobStatus.tone}>{jobStatus.label}</StatusChip>
                      </div>

                      <button
                        type="button"
                        className="job-work-card__delete"
                        onClick={() => deleteJob(job)}
                        disabled={isDeletingJob}
                        aria-label={`Delete job for ${job.name}`}
                      >
                        X
                      </button>

                      <div className="job-work-card__header">
                        <div className="job-work-card__identity">
                          <p className="job-work-card__eyebrow">Client</p>
                          <h3>{job.name}</h3>
                          <p className="job-work-card__subcopy">{job.job_type} at {job.address || 'Address needed'}</p>
                        </div>
                      </div>

                      <div className="job-work-card__summary">
                        <div className="job-work-card__summary-item">
                          <span>Visit window</span>
                          <strong>{formatDate(job.job_date)} | {formatTimeRange(job.start_time)}</strong>
                        </div>
                        <div className="job-work-card__summary-item job-work-card__summary-item--payment">
                          <span>Payment</span>
                          <strong>{formatCurrency(job.payment)}</strong>
                        </div>
                      </div>

                      <div className="job-work-card__footer">
                        <div className="job-work-card__field job-work-card__field--status">
                          <label>Status</label>
                          <select
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
                            className="comments-button"
                            onClick={() => openEditModal(job)}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
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
              {(() => {
                const jobStatus = getJobStatusMeta(selectedJob.status)

                return <StatusChip tone={jobStatus.tone}>{jobStatus.label}</StatusChip>
              })()}
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
