import { useApi } from './apiContext'
import { useEffect, useMemo, useState } from 'react'
import JobEditorModal from './JobEditorModal'
import { buildClients } from './clientUtils'
import { getJobTypePalette, JOB_TYPE_OPTIONS } from './jobTypes'
import { parseDateValue } from './dateUtils'

const CALENDAR_VIEWS = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' }
]

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_TIMELINE_DEFAULT_START_HOUR = 8
const DAY_TIMELINE_DEFAULT_END_HOUR = 18
const DAY_TIMELINE_MIN_VISIBLE_HOURS = 8
const DAY_TIMELINE_ROW_HEIGHT = 76
const DAY_TIMELINE_EVENT_GAP = 12
const DAY_TIMELINE_EVENT_HEIGHT_REDUCTION = 12
const DEFAULT_JOB_DURATION_MINUTES = 60

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

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue) return null

  const match = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null
  }

  return (hours * 60) + minutes
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

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

const formatTimelineLabel = (totalMinutes) =>
  new Date(2000, 0, 1, Math.floor(totalMinutes / 60), totalMinutes % 60).toLocaleTimeString('en-US', {
    hour: 'numeric'
  })

const formatClockTime = (totalMinutes) =>
  new Date(2000, 0, 1, Math.floor(totalMinutes / 60), totalMinutes % 60).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })

const formatFullDate = (dateString) => {
  const date = parseDateValue(dateString)
  if (!date) return '-'

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

const getMonthDaySummary = (dayJobs) => {
  if (dayJobs.length === 0) return 'Open'

  const scheduledTimes = dayJobs
    .map((job) => parseTimeToMinutes(job.start_time))
    .filter((time) => time !== null)

  if (scheduledTimes.length === 0) {
    return `${dayJobs.length} job${dayJobs.length === 1 ? '' : 's'} without a time`
  }

  const earliestStart = Math.min(...scheduledTimes)
  const latestStart = Math.max(...scheduledTimes)

  if (scheduledTimes.length === 1 && dayJobs.length === 1) {
    return `1 job at ${formatClockTime(earliestStart)}`
  }

  return `${dayJobs.length} jobs from ${formatClockTime(earliestStart)} to ${formatClockTime(latestStart)}`
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

const assignTimelineColumns = (scheduledJobs) => {
  const sortedJobs = [...scheduledJobs].sort(
    (first, second) => first.startMinutes - second.startMinutes || first.job.name.localeCompare(second.job.name)
  )
  const laidOutJobs = []
  let cluster = []
  let clusterEndMinutes = 0

  const flushCluster = () => {
    if (cluster.length === 0) return

    const columnEndTimes = []
    let columnCount = 1

    const positionedCluster = cluster.map((item) => {
      let columnIndex = columnEndTimes.findIndex((endMinutes) => endMinutes <= item.startMinutes)

      if (columnIndex === -1) {
        columnIndex = columnEndTimes.length
        columnEndTimes.push(item.endMinutes)
      } else {
        columnEndTimes[columnIndex] = item.endMinutes
      }

      columnCount = Math.max(columnCount, columnEndTimes.length)

      return {
        ...item,
        columnIndex
      }
    })

    laidOutJobs.push(
      ...positionedCluster.map((item) => ({
        ...item,
        columnCount
      }))
    )

    cluster = []
    clusterEndMinutes = 0
  }

  sortedJobs.forEach((item) => {
    if (cluster.length === 0) {
      cluster = [item]
      clusterEndMinutes = item.endMinutes
      return
    }

    if (item.startMinutes < clusterEndMinutes) {
      cluster.push(item)
      clusterEndMinutes = Math.max(clusterEndMinutes, item.endMinutes)
      return
    }

    flushCluster()
    cluster = [item]
    clusterEndMinutes = item.endMinutes
  })

  flushCluster()

  return laidOutJobs
}

const buildDayTimeline = (dayJobs) => {
  const scheduledJobs = []
  const unscheduledJobs = []

  dayJobs.forEach((job) => {
    const startMinutes = parseTimeToMinutes(job.start_time)

    if (startMinutes === null) {
      unscheduledJobs.push(job)
      return
    }

    scheduledJobs.push({
      job,
      startMinutes,
      endMinutes: Math.min(startMinutes + DEFAULT_JOB_DURATION_MINUTES, 24 * 60)
    })
  })

  let startHour = DAY_TIMELINE_DEFAULT_START_HOUR
  let endHour = DAY_TIMELINE_DEFAULT_END_HOUR

  if (scheduledJobs.length > 0) {
    const earliestStartMinutes = Math.min(...scheduledJobs.map((item) => item.startMinutes))
    const latestEndMinutes = Math.max(...scheduledJobs.map((item) => item.endMinutes))

    startHour = clamp(Math.floor(earliestStartMinutes / 60), 0, 23)
    endHour = clamp(Math.ceil(latestEndMinutes / 60), 1, 24)

    if (endHour - startHour < DAY_TIMELINE_MIN_VISIBLE_HOURS) {
      if (startHour <= DAY_TIMELINE_DEFAULT_START_HOUR) {
        endHour = Math.min(24, startHour + DAY_TIMELINE_MIN_VISIBLE_HOURS)
      } else {
        startHour = Math.max(0, endHour - DAY_TIMELINE_MIN_VISIBLE_HOURS)
      }
    }
  }

  if (endHour - startHour < DAY_TIMELINE_MIN_VISIBLE_HOURS) {
    endHour = Math.min(24, startHour + DAY_TIMELINE_MIN_VISIBLE_HOURS)
    startHour = Math.max(0, endHour - DAY_TIMELINE_MIN_VISIBLE_HOURS)
  }

  const timelineStartMinutes = startHour * 60
  const visibleHourCount = Math.max(endHour - startHour, 1)

  return {
    scheduledJobs: assignTimelineColumns(scheduledJobs),
    unscheduledJobs,
    timelineStartMinutes,
    visibleHourCount,
    timeSlots: Array.from({ length: visibleHourCount }, (_, index) => timelineStartMinutes + (index * 60))
  }
}

function CalendarJobCard({ job, onClick, onEdit, compact = false, className = '', style, showMeta = !compact }) {
  return (
    <div
      className={`calendar-job-pill${compact ? ' calendar-job-pill--compact' : ''}${onEdit ? ' calendar-job-pill--editable' : ''}${className ? ` ${className}` : ''}`}
      style={{ ...getCalendarJobStyle(job.job_type), ...style }}
    >
      <button
        type="button"
        className="calendar-job-pill-main"
        onClick={() => onClick(job)}
      >
        <span className="calendar-job-pill-title">{job.name}</span>
        <span className="calendar-job-pill-type">{formatTimeRange(job.start_time)}</span>
        {showMeta && (
          <span className="calendar-job-pill-meta">
            {job.address || 'No address'} | {formatCurrency(job.payment)}
          </span>
        )}
      </button>
      {onEdit ? (
        <button
          type="button"
          className="calendar-job-pill-edit"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(job)
          }}
        >
          Edit
        </button>
      ) : null}
    </div>
  )
}

export default function CalendarPage({ currentUser }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [editingJob, setEditingJob] = useState(null)
  const [isSavingJob, setIsSavingJob] = useState(false)
  const [isDeletingJob, setIsDeletingJob] = useState(false)
  const [editError, setEditError] = useState('')
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
      const date = parseDateValue(job.job_date)
      if (!date) return

      const key = getDateKey(date)
      const existingJobs = map.get(key) || []
      existingJobs.push(job)
      map.set(
        key,
        existingJobs.sort((first, second) => {
          const firstTime = parseTimeToMinutes(first.start_time)
          const secondTime = parseTimeToMinutes(second.start_time)

          if (firstTime === null && secondTime === null) {
            return first.name.localeCompare(second.name)
          }

          if (firstTime === null) return 1
          if (secondTime === null) return -1

          return firstTime - secondTime || first.name.localeCompare(second.name)
        })
      )
    })

    return map
  }, [jobs])
  const clients = useMemo(() => buildClients(jobs), [jobs])

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

  const openEditJob = (job) => {
    setEditingJob(job)
    setEditError('')
  }

  const closeEditJob = () => {
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

    setSelectedJob((current) => {
      if (!current || current.id !== jobId) return current
      return {
        ...current,
        ...updates,
        payment:
          updates.payment !== undefined
            ? Number(updates.payment).toFixed(2)
            : current.payment,
        comments:
          updates.comments !== undefined
            ? updates.comments || null
            : current.comments
      }
    })
  }

  const removeJob = (jobId) => {
    setJobs((prev) => prev.filter((job) => job.id !== jobId))
    setSelectedJob((current) => (current?.id === jobId ? null : current))
    setEditingJob((current) => (current?.id === jobId ? null : current))
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
      closeEditJob()
    } catch (err) {
      console.error('Error updating calendar job:', err)
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
      console.error('Error deleting calendar job:', err)
      setEditError(err.message || 'Unable to delete job')
    } finally {
      setIsDeletingJob(false)
    }
  }

  const renderDailyView = () => {
    const dayJobs = jobsByDate.get(getDateKey(anchorDate)) || []
    const { scheduledJobs, unscheduledJobs, timelineStartMinutes, visibleHourCount, timeSlots } = buildDayTimeline(dayJobs)
    const timelineHeight = visibleHourCount * DAY_TIMELINE_ROW_HEIGHT

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
            <>
              {scheduledJobs.length > 0 ? (
                <div
                  className="calendar-day-timeline-shell"
                  style={{
                    '--calendar-timeline-rows': visibleHourCount,
                    '--calendar-timeline-row-height': `${DAY_TIMELINE_ROW_HEIGHT}px`
                  }}
                >
                  <div className="calendar-time-rail" aria-hidden="true">
                    {timeSlots.map((slotMinutes) => (
                      <div key={`label-${slotMinutes}`} className="calendar-time-label">
                        {formatTimelineLabel(slotMinutes)}
                      </div>
                    ))}
                  </div>

                  <div className="calendar-time-grid-wrap">
                    <div className="calendar-time-grid">
                      {timeSlots.map((slotMinutes) => (
                        <div key={`row-${slotMinutes}`} className="calendar-time-grid-row" />
                      ))}

                      <div className="calendar-time-grid-overlay" style={{ height: `${timelineHeight}px` }}>
                        {scheduledJobs.map(({ job, startMinutes, endMinutes, columnIndex, columnCount }) => {
                          const topOffset = ((startMinutes - timelineStartMinutes) / 60) * DAY_TIMELINE_ROW_HEIGHT-DEFAULT_JOB_DURATION_MINUTES / 60 * DAY_TIMELINE_ROW_HEIGHT
                          const durationMinutes = Math.max(endMinutes - startMinutes, DEFAULT_JOB_DURATION_MINUTES)
                          const eventHeight = Math.max(
                            (durationMinutes / 60) * DAY_TIMELINE_ROW_HEIGHT,
                            44
                          )
                          const topAdjustment =
                            startMinutes === timelineStartMinutes ? 0 : DAY_TIMELINE_EVENT_HEIGHT_REDUCTION
                          const columnWidth = 100 / columnCount
                          const leftOffset = columnIndex * columnWidth

                          return (
                          <CalendarJobCard
                              key={job.id}
                              job={job}
                              onClick={openJobDetails}
                              onEdit={openEditJob}
                              className="calendar-job-pill--timeline"
                              showMeta
                              style={{
                                top: `${Math.max(topOffset - topAdjustment, 0)}px`,
                                height: `${eventHeight}px`,
                                left: `calc(${leftOffset}% + ${DAY_TIMELINE_EVENT_GAP / 2}px)`,
                                width: `calc(${columnWidth}% - ${DAY_TIMELINE_EVENT_GAP}px)`
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="calendar-empty-panel calendar-empty-panel--compact">
                  <p>No jobs on this day have a start time yet.</p>
                </div>
              )}

              {unscheduledJobs.length > 0 && (
                <div className="calendar-day-secondary-list">
                  <div className="calendar-day-secondary-header">
                    <h5>Need a timeslot</h5>
                    <span>{unscheduledJobs.length} without a start time</span>
                  </div>
                  <div className="calendar-agenda-list calendar-agenda-list--secondary">
                    {unscheduledJobs.map((job) => (
                      <CalendarJobCard key={job.id} job={job} onClick={openJobDetails} onEdit={openEditJob} compact />
                    ))}
                  </div>
                </div>
              )}
            </>
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

            return (
              <button
                key={dateKey}
                type="button"
                className={`calendar-day${
                  date.getMonth() !== currentMonth ? ' calendar-day--outside' : ''
                }${dateKey === todayKey ? ' calendar-day--today' : ''} calendar-day--button`}
                onClick={() => {
                  setAnchorDate(date)
                  setCalendarView('day')
                }}
              >
                <div className="calendar-day-header">
                  <div className="calendar-day-number">{date.getDate()}</div>
                  <div className="calendar-day-count">
                    {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="calendar-day-jobs">
                  <p className="calendar-day-summary">{getMonthDaySummary(dayJobs)}</p>
                  {dayJobs.length > 0 ? <p className="calendar-day-more">Open day view</p> : null}
                </div>
              </button>
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
                {formatFullDate(selectedJob.job_date)} - {formatTimeRange(selectedJob.start_time)}
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
                className="comments-modal-button comments-modal-button--primary"
                onClick={() => {
                  openEditJob(selectedJob)
                  closeJobDetails()
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
                className="comments-modal-button comments-modal-button--ghost"
                onClick={closeJobDetails}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingJob && (
        <JobEditorModal
          key={editingJob.id}
          job={editingJob}
          clients={clients}
          saving={isSavingJob}
          deleting={isDeletingJob}
          error={editError}
          onClose={closeEditJob}
          onSave={saveJobEdits}
          onDelete={deleteJob}
        />
      )}
    </div>
  )
}
