import { useApi } from './apiContext'
import { useEffect, useMemo, useState } from 'react'
import { getJobTypePalette, JOB_TYPE_OPTIONS } from './jobTypes'

const CALENDAR_VIEWS = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' }
]

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE_JOBS_PER_DAY = 3

const startOfDay = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const addDays = (value, amount) => {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return startOfDay(date)
}

const startOfWeek = (value) => {
  const date = startOfDay(value)
  const offset = (date.getDay() + 6) % 7
  return addDays(date, -offset)
}

const startOfMonth = (value) => {
  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

const startOfYear = (value) => {
  const date = new Date(value)
  return new Date(date.getFullYear(), 0, 1)
}

const getDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

const formatWeekdayLabel = (date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'short'
  })

const formatDayNumber = (date) =>
  date.toLocaleDateString('en-US', {
    day: 'numeric'
  })

const formatShortDate = (date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
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

const buildMonthGrid = (visibleDate) => {
  const monthStart = startOfMonth(visibleDate)
  const gridStart = startOfWeek(monthStart)

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

const getCalendarRangeLabel = (view, anchorDate) => {
  if (view === 'day') {
    return anchorDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (view === 'week') {
    const weekStart = startOfWeek(anchorDate)
    const weekEnd = addDays(weekStart, 6)
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
    const sameYear = weekStart.getFullYear() === weekEnd.getFullYear()

    if (sameMonth && sameYear) {
      return `${weekStart.toLocaleDateString('en-US', {
        month: 'long'
      })} ${weekStart.getDate()}-${weekEnd.getDate()}, ${weekStart.getFullYear()}`
    }

    return `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}, ${weekEnd.getFullYear()}`
  }

  if (view === 'month') {
    return formatMonthLabel(anchorDate)
  }

  return String(anchorDate.getFullYear())
}

const getCalendarJobStyle = (jobType) => {
  const palette = getJobTypePalette(jobType)

  return {
    '--job-bg': palette.background,
    '--job-border': palette.border,
    '--job-text': palette.text
  }
}

function CalendarJobCard({ job, onClick, compact = false }) {
  return (
    <button
      type="button"
      className={`calendar-job-pill${compact ? ' calendar-job-pill--compact' : ''}`}
      style={getCalendarJobStyle(job.job_type)}
      onClick={() => onClick(job)}
    >
      <span className="calendar-job-pill-title">{job.name}</span>
      <span className="calendar-job-pill-type">{formatTimeRange(job.start_time)}</span>
      <span className="calendar-job-pill-type">{job.job_type}</span>
      {!compact && (
        <span className="calendar-job-pill-meta">
          {job.address || 'No address'} | {formatCurrency(job.payment)}
        </span>
      )}
    </button>
  )
}

export default function CalendarPage({ currentUser }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [calendarView, setCalendarView] = useState('day')
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()))

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
        existingJobs.sort((first, second) => {
          const firstTime = String(first.start_time || '')
          const secondTime = String(second.start_time || '')
          return firstTime.localeCompare(secondTime) || first.name.localeCompare(second.name)
        })
      )
    })

    return map
  }, [jobs])

  const today = startOfDay(new Date())
  const todayKey = getDateKey(today)

  const stepCalendar = (direction) => {
    setAnchorDate((current) => {
      if (calendarView === 'day') {
        return addDays(current, direction)
      }

      if (calendarView === 'week') {
        return addDays(current, direction * 7)
      }

      if (calendarView === 'month') {
        return new Date(current.getFullYear(), current.getMonth() + direction, 1)
      }

      return new Date(current.getFullYear() + direction, 0, 1)
    })
  }

  const jumpToToday = () => {
    setAnchorDate(today)
    setCalendarView('day')
  }

  const openJobDetails = (job) => {
    setSelectedJob(job)
  }

  const closeJobDetails = () => {
    setSelectedJob(null)
  }

  const renderDailyView = () => {
    const dayJobs = jobsByDate.get(getDateKey(anchorDate)) || []

    return (
      <div className="calendar-day-view">
        <div className="calendar-focus-card">
          <span className="calendar-focus-kicker">{formatWeekdayLabel(anchorDate)}</span>
          <strong className="calendar-focus-number">{anchorDate.getDate()}</strong>
          <span className="calendar-focus-month">
            {anchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="calendar-agenda-card">
          <div className="calendar-agenda-header">
            <div>
              <h4>Appointments for the day</h4>
              <p>{dayJobs.length} scheduled job{dayJobs.length === 1 ? '' : 's'}</p>
            </div>
          </div>

          {dayJobs.length === 0 ? (
            <div className="calendar-empty-panel">
              <p>No jobs are scheduled for this day.</p>
            </div>
          ) : (
            <div className="calendar-agenda-list">
              {dayJobs.map((job) => (
                <CalendarJobCard key={job.id} job={job} onClick={openJobDetails} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderWeeklyView = () => {
    const weekStart = startOfWeek(anchorDate)
    const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

    return (
      <div className="calendar-week-board">
        {weekDays.map((date) => {
          const dateKey = getDateKey(date)
          const dayJobs = jobsByDate.get(dateKey) || []

          return (
            <div
              key={dateKey}
              className={`calendar-week-column${dateKey === todayKey ? ' calendar-week-column--today' : ''}`}
            >
              <div className="calendar-week-column-header">
                <span>{formatWeekdayLabel(date)}</span>
                <strong>{formatDayNumber(date)}</strong>
              </div>

              <div className="calendar-week-column-body">
                {dayJobs.length === 0 ? (
                  <p className="calendar-week-empty">No jobs</p>
                ) : (
                  dayJobs.map((job) => (
                    <CalendarJobCard key={job.id} job={job} onClick={openJobDetails} compact />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderMonthlyView = () => {
    const monthDays = buildMonthGrid(anchorDate)
    const currentMonth = anchorDate.getMonth()

    return (
      <div className="calendar-grid-wrap">
        <div className="calendar-grid calendar-grid--month">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}

          {monthDays.map((date) => {
            const dateKey = getDateKey(date)
            const dayJobs = jobsByDate.get(dateKey) || []
            const visibleJobs = dayJobs.slice(0, MAX_VISIBLE_JOBS_PER_DAY)
            const remainingJobs = dayJobs.length - visibleJobs.length

            return (
              <div
                key={dateKey}
                className={`calendar-day${
                  date.getMonth() !== currentMonth ? ' calendar-day--outside' : ''
                }${dateKey === todayKey ? ' calendar-day--today' : ''}`}
              >
                <div className="calendar-day-number">{date.getDate()}</div>
                <div className="calendar-day-jobs">
                  {visibleJobs.map((job) => (
                    <CalendarJobCard key={job.id} job={job} onClick={openJobDetails} compact />
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
    )
  }

  const renderYearlyView = () => {
    const yearStart = startOfYear(anchorDate)
    const months = Array.from({ length: 12 }, (_, index) => new Date(yearStart.getFullYear(), index, 1))

    return (
      <div className="calendar-year-grid">
        {months.map((monthDate) => {
          const monthDays = buildMonthGrid(monthDate)
          const currentMonth = monthDate.getMonth()

          return (
            <div key={monthDate.toISOString()} className="calendar-year-card">
              <div className="calendar-year-card-header">
                <h4>{monthDate.toLocaleDateString('en-US', { month: 'long' })}</h4>
              </div>

              <div className="calendar-mini-grid">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={`${monthDate.getMonth()}-${label}`} className="calendar-mini-weekday">
                    {label.slice(0, 1)}
                  </span>
                ))}

                {monthDays.map((date) => {
                  const dateKey = getDateKey(date)
                  const dayJobs = jobsByDate.get(dateKey) || []
                  const firstJob = dayJobs[0]

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={`calendar-mini-day${
                        date.getMonth() !== currentMonth ? ' calendar-mini-day--outside' : ''
                      }${dateKey === todayKey ? ' calendar-mini-day--today' : ''}`}
                      onClick={() => {
                        setAnchorDate(date)
                        setCalendarView('day')
                      }}
                    >
                      <span>{date.getDate()}</span>
                      {firstJob && (
                        <span
                          className="calendar-mini-dot"
                          style={{ background: getJobTypePalette(firstJob.job_type).background }}
                        />
                      )}
                      {dayJobs.length > 1 && (
                        <span className="calendar-mini-count">{dayJobs.length}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
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
          <p>Switch between daily, weekly, monthly, and yearly views. The calendar opens on the daily schedule by default.</p>
        </div>

        <div className="calendar-toolbar-actions">
          <div className="calendar-view-toggle" role="tablist" aria-label="Calendar views">
            {CALENDAR_VIEWS.map((view) => (
              <button
                key={view.key}
                type="button"
                className={`calendar-view-button${calendarView === view.key ? ' calendar-view-button--active' : ''}`}
                onClick={() => setCalendarView(view.key)}
              >
                {view.label}
              </button>
            ))}
          </div>

          <div className="calendar-controls">
            <button type="button" className="calendar-control-button" onClick={() => stepCalendar(-1)}>
              Previous
            </button>
            <button type="button" className="calendar-control-button calendar-control-button--today" onClick={jumpToToday}>
              Today
            </button>
            <button type="button" className="calendar-control-button" onClick={() => stepCalendar(1)}>
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-range-banner">
        <div>
          <span className="calendar-range-label">{CALENDAR_VIEWS.find((view) => view.key === calendarView)?.label}</span>
          <h4>{getCalendarRangeLabel(calendarView, anchorDate)}</h4>
        </div>
      </div>

      <div className="calendar-legend">
        {JOB_TYPE_OPTIONS.map((jobType) => (
          <div key={jobType} className="calendar-legend-item">
            <span
              className="calendar-legend-swatch"
              style={{ background: getJobTypePalette(jobType).background }}
            />
            <span>{jobType}</span>
          </div>
        ))}
      </div>

      {calendarView === 'day' && renderDailyView()}
      {calendarView === 'week' && renderWeeklyView()}
      {calendarView === 'month' && renderMonthlyView()}
      {calendarView === 'year' && renderYearlyView()}

      {selectedJob && (
        <div className="comments-modal-backdrop" onClick={closeJobDetails}>
          <div className="comments-modal calendar-details-modal" onClick={(event) => event.stopPropagation()}>
            <div className="comments-modal-header">
              <h3>{selectedJob.name}</h3>
              <p className="comments-modal-subtitle">
                {selectedJob.job_type} - {formatFullDate(selectedJob.job_date)} - {formatTimeRange(selectedJob.start_time)}
              </p>
            </div>

            <div className="calendar-details-grid">
              <div className="calendar-details-item">
                <span className="calendar-details-label">Phone</span>
                <strong>{selectedJob.phone || '-'}</strong>
              </div>
              <div className="calendar-details-item">
                <span className="calendar-details-label">Time</span>
                <strong>{formatTimeRange(selectedJob.start_time)}</strong>
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
