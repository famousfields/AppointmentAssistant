import { useApi } from './apiContext'
import { useEffect, useMemo, useState } from 'react'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_JOBS_PER_DAY = 3

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value) || 0)

const formatMonthLabel = (date) =>
  date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })

const formatFullDate = (dateString) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const getDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const buildCalendarDays = (visibleMonth) => {
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days = []

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push(null)
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day))
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  return days
}

export default function CalendarPage({ currentUser }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedJob, setSelectedJob] = useState(null)

  const { fetchWithAuth } = useApi()

  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      setJobs([])
      setError('Please log in to view your calendar.')
      return
    }

    const fetchJobs = async () => {
      setLoading(true)
      setError('')

      try {
        const res = await fetchWithAuth('/jobs')
        if (!res.ok) throw new Error('Failed to fetch jobs')
        const data = await res.json()
        setJobs(data)
      } catch (err) {
        console.error('Error fetching calendar jobs:', err)
        setError("We couldn't load the calendar right now.")
      } finally {
        setLoading(false)
      }
    }

    fetchJobs()
  }, [currentUser, fetchWithAuth])

  const jobsByDate = useMemo(() => {
    const map = new Map()

    jobs.forEach((job) => {
      const date = new Date(job.job_date)
      if (Number.isNaN(date.getTime())) return

      const key = getDateKey(date)
      const existingJobs = map.get(key) || []
      existingJobs.push(job)
      map.set(
        key,
        existingJobs.sort((a, b) => a.name.localeCompare(b.name))
      )
    })

    return map
  }, [jobs])

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth]
  )

  const todayKey = getDateKey(new Date())

  const openJobDetails = (job) => {
    setSelectedJob(job)
  }

  const closeJobDetails = () => {
    setSelectedJob(null)
  }

  if (loading) {
    return (
      <div className="calendar-page">
        <div className="jobs-state-card">
          <div>
            <h3>Loading calendar...</h3>
            <p>We are organizing your jobs by date now.</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="calendar-page">
        <div className="jobs-state-card">
          <div>
            <h3 className="jobs-error">Unable to show calendar</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="calendar-page">
        <div className="jobs-empty-state">
          <div>
            <h3>No jobs scheduled</h3>
            <p>Create your first appointment to populate the calendar.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="calendar-page">
      <div className="calendar-toolbar">
        <div>
          <h3>Job calendar</h3>
          <p>Browse your schedule by month and open any job for a quick read-only summary.</p>
        </div>
        <div className="calendar-controls">
          <button
            type="button"
            className="calendar-control-button"
            onClick={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
              )
            }
          >
            Previous
          </button>
          <button
            type="button"
            className="calendar-control-button calendar-control-button--today"
            onClick={() => {
              const today = new Date()
              setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
            }}
          >
            Current month
          </button>
          <button
            type="button"
            className="calendar-control-button"
            onClick={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
              )
            }
          >
            Next
          </button>
        </div>
      </div>

      <div className="calendar-grid-wrap">
        <div className="calendar-header">
          <h4>{formatMonthLabel(visibleMonth)}</h4>
        </div>

        <div className="calendar-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}

          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="calendar-day calendar-day--empty" />
            }

            const dateKey = getDateKey(date)
            const dayJobs = jobsByDate.get(dateKey) || []
            const visibleJobs = dayJobs.slice(0, MAX_VISIBLE_JOBS_PER_DAY)
            const remainingJobs = dayJobs.length - visibleJobs.length

            return (
              <div
                key={dateKey}
                className={`calendar-day${
                  dateKey === todayKey ? ' calendar-day--today' : ''
                }`}
              >
                <div className="calendar-day-number">{date.getDate()}</div>
                <div className="calendar-day-jobs">
                  {visibleJobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      className="calendar-job-pill"
                      onClick={() => openJobDetails(job)}
                    >
                      <span className="calendar-job-pill-title">{job.name}</span>
                      <span className="calendar-job-pill-type">{job.job_type}</span>
                    </button>
                  ))}
                  {remainingJobs > 0 && (
                    <p className="calendar-day-more">+{remainingJobs} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedJob && (
        <div className="comments-modal-backdrop" onClick={closeJobDetails}>
          <div className="comments-modal calendar-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comments-modal-header">
              <h3>{selectedJob.name}</h3>
              <p className="comments-modal-subtitle">
                {selectedJob.job_type} - {formatFullDate(selectedJob.job_date)}
              </p>
            </div>

            <div className="calendar-details-grid">
              <div className="calendar-details-item">
                <span className="calendar-details-label">Phone</span>
                <strong>{selectedJob.phone || '-'}</strong>
              </div>
              <div className="calendar-details-item">
                <span className="calendar-details-label">Status</span>
                <strong>{selectedJob.status || '-'}</strong>
              </div>
              <div className="calendar-details-item calendar-details-item--full">
                <span className="calendar-details-label">Address</span>
                <strong>{selectedJob.address || '-'}</strong>
              </div>
              <div className="calendar-details-item">
                <span className="calendar-details-label">Payment</span>
                <strong>{formatCurrency(selectedJob.payment)}</strong>
              </div>
              <div className="calendar-details-item calendar-details-item--full">
                <span className="calendar-details-label">Comments</span>
                <strong>{selectedJob.comments || 'No notes yet'}</strong>
              </div>
            </div>

            <div className="comments-modal-actions">
              <button
                type="button"
                className="comments-modal-button comments-modal-button--ghost"
                onClick={closeJobDetails}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
