import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import {
  API_BASE,
  apiFetch,
  buildSessionRecord,
  clearJobDraft,
  loadJobDraft,
  loadStoredSession,
  persistJobDraft,
  persistSession
} from './src/api'
import { colors, commonStyles } from './src/theme'

const NAV_ITEMS = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'jobs-new', label: 'New Job' },
  { key: 'clients', label: 'Clients' }
]

const JOB_STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']
const JOB_TYPE_OPTIONS = ['0 Turn Mower', 'Push Mower', 'Riding Mower', 'Pressure Washer']
const CALENDAR_VIEWS = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' }
]
const PHONE_EXAMPLE = '(555) 123-4567'
const DEFAULT_JOB_DURATION_MINUTES = 60
const DAY_TIMELINE_DEFAULT_START_HOUR = 8
const DAY_TIMELINE_DEFAULT_END_HOUR = 18
const DAY_TIMELINE_MIN_VISIBLE_HOURS = 8
const DAY_TIMELINE_ROW_HEIGHT = 76
const DAY_TIMELINE_MIN_CARD_HEIGHT = 56
const JOB_TYPE_COLORS = {
  '0 Turn Mower': { background: '#22c55e', border: '#16a34a', text: '#f0fdf4' },
  'Push Mower': { background: '#f97316', border: '#ea580c', text: '#fff7ed' },
  'Riding Mower': { background: '#3b82f6', border: '#2563eb', text: '#eff6ff' },
  'Pressure Washer': { background: '#06b6d4', border: '#0891b2', text: '#ecfeff' }
}

const EMPTY_JOB_FORM = {
  name: '',
  phone: '',
  address: '',
  jobType: '',
  jobDate: '',
  startTime: '',
  payment: '',
  comments: ''
}

const parseDateValue = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, year, month, day] = match
      const date = new Date(Number(year), Number(month) - 1, Number(day))
      const isValid =
        date.getFullYear() === Number(year) &&
        date.getMonth() === Number(month) - 1 &&
        date.getDate() === Number(day)

      return isValid ? date : null
    }
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDateValue = (value) => {
  const date = parseDateValue(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseTimeValue = (value) => {
  if (!value) return null
  const match = String(value).match(/^(\d{2}):(\d{2})/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return { hours, minutes }
}

const formatTimeValue = (value) => {
  const parsed = parseTimeValue(value)
  if (!parsed) return ''
  return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`
}

const parseTimeToMinutes = (value) => {
  const parsed = parseTimeValue(value)
  if (!parsed) return null
  return (parsed.hours * 60) + parsed.minutes
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getDateTimestamp = (value) => {
  const date = parseDateValue(value)
  return date ? date.getTime() : 0
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = parseDateValue(value)
  if (!date) return '-'
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)

const formatMonth = (value) =>
  value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

const formatFullDate = (value) => {
  const date = parseDateValue(value)
  if (!date) return '-'

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatTimeRange = (value) => {
  const parsed = parseTimeValue(value)
  if (!parsed) return '-'

  const start = new Date(2000, 0, 1, parsed.hours, parsed.minutes)
  const end = new Date(2000, 0, 1, parsed.hours + 1, parsed.minutes)

  return `${start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })} - ${end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })}`
}

const normalizePhoneDigits = (value) =>
  String(value || '').replace(/\D/g, '').slice(0, 15)

const formatPhonePreview = (value) => {
  const digits = normalizePhoneDigits(value)

  if (!digits) return PHONE_EXAMPLE

  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`

  if (digits[0] === '1' && digits.length <= 11) {
    const local = digits.slice(1)
    if (local.length <= 3) return `1 (${local}`
    if (local.length <= 6) return `1 (${local.slice(0, 3)}) ${local.slice(3)}`
    return `1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  }

  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim()
}

const keyboardAvoidingBehavior = Platform.OS === 'ios' ? 'padding' : 'height'

const buildJobPayload = (job) => ({
  ...job,
  jobDate: formatDateValue(job.jobDate),
  startTime: formatTimeValue(job.startTime),
  payment: job.payment === '' ? 0 : Number(job.payment)
})

const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfDay = (value) => {
  const date = parseDateValue(value) || new Date(value)
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
  const date = parseDateValue(value) || new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

const startOfYear = (value) => {
  const date = parseDateValue(value) || new Date(value)
  return new Date(date.getFullYear(), 0, 1)
}

const buildMonthGrid = (value) => {
  const monthStart = startOfMonth(value)
  const gridStart = startOfWeek(monthStart)
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

const getJobTypeColors = (jobType) =>
  JOB_TYPE_COLORS[jobType] || JOB_TYPE_COLORS[JOB_TYPE_OPTIONS[0]]

const assignTimelineColumns = (scheduledJobs) => {
  const sortedJobs = [...scheduledJobs].sort(
    (first, second) =>
      first.startMinutes - second.startMinutes ||
      String(first.job.name || '').localeCompare(String(second.job.name || ''))
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

    startHour = clamp(Math.floor((earliestStartMinutes - 60) / 60), 0, 23)
    endHour = clamp(Math.ceil((latestEndMinutes + 60) / 60), 1, 24)

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

const formatTimelineHourLabel = (value) =>
  new Date(2000, 0, 1, Math.floor(value / 60), value % 60).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).replace(':00', '')

const getCalendarRangeLabel = (view, anchorDate) => {
  if (view === 'day') {
    return formatFullDate(anchorDate)
  }

  if (view === 'week') {
    const weekStart = startOfWeek(anchorDate)
    const weekEnd = addDays(weekStart, 6)
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
    const sameYear = weekStart.getFullYear() === weekEnd.getFullYear()

    if (sameMonth && sameYear) {
      return `${weekStart.toLocaleDateString('en-US', { month: 'long' })} ${weekStart.getDate()}-${weekEnd.getDate()}, ${weekStart.getFullYear()}`
    }

    return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`
  }

  if (view === 'month') {
    return formatMonth(anchorDate)
  }

  return String(startOfYear(anchorDate).getFullYear())
}

const buildClients = (jobs) => {
  const map = new Map()

  jobs.forEach((job) => {
    const key = job.client_id ?? `${job.name}|${job.phone}|${job.address}`
    if (!map.has(key)) {
      map.set(key, { id: key, name: job.name, phone: job.phone, address: job.address, jobs: [] })
    }
    map.get(key).jobs.push(job)
  })

  return Array.from(map.values())
    .map((client) => ({
      ...client,
      jobs: [...client.jobs].sort((a, b) => getDateTimestamp(b.job_date) - getDateTimestamp(a.job_date)),
      totalPayments: client.jobs.reduce((sum, job) => sum + (Number(job.payment) || 0), 0)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const getClientSuggestions = (clients, query, field) => {
  const value = String(query || '').trim().toLowerCase()
  if (!value) return []

  if (field === 'phone') {
    const digits = normalizePhoneDigits(query)
    if (!digits) return []
    return clients.filter((client) => normalizePhoneDigits(client.phone || '').includes(digits))
  }

  return clients.filter((client) => String(client[field] || '').toLowerCase().includes(value))
}

const applyClientDetails = (client) => ({
  name: client.name || '',
  phone: normalizePhoneDigits(client.phone || ''),
  address: client.address || ''
})


export default function App() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState(null)
  const [apiHealth, setApiHealth] = useState({ status: 'checking', message: 'Checking backend...' })
  const [activeTab, setActiveTab] = useState('calendar')
  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '', email: '', confirmPassword: '' })
  const [authErrors, setAuthErrors] = useState({})
  const [authStatus, setAuthStatus] = useState(null)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [jobForm, setJobForm] = useState(EMPTY_JOB_FORM)
  const [jobErrors, setJobErrors] = useState({})
  const [jobStatus, setJobStatus] = useState(null)
  const [jobSuggestionField, setJobSuggestionField] = useState(null)
  const [clientSearch, setClientSearch] = useState('')
  const [calendarView, setCalendarView] = useState('day')
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => startOfDay(new Date()))

  useEffect(() => {
    const bootstrap = async () => {
      const [storedSession, storedDraft] = await Promise.all([loadStoredSession(), loadJobDraft()])
      if (storedSession) setSession(storedSession)
      if (storedDraft) setJobForm((current) => ({ ...current, ...storedDraft }))
      setReady(true)
    }
    bootstrap()
  }, [])

  useEffect(() => {
    let active = true

    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`)
        if (!response.ok) {
          throw new Error(`Backend responded with ${response.status}`)
        }

        await response.json().catch(() => ({}))
        if (active) {
          setApiHealth({
            status: 'success',
          })
        }
      } catch (error) {
        if (active) {
          setApiHealth({
            status: 'error',
            message: `Cannot reach ${API_BASE}`
          })
        }
      }
    }

    checkBackend()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    persistSession(session)
  }, [session])

  useEffect(() => {
    persistJobDraft(jobForm)
  }, [jobForm])

  useEffect(() => {
    if (!session) {
      setJobs([])
      return
    }

    let active = true
    const loadJobs = async () => {
      setJobsLoading(true)
      setJobsError('')
      try {
        const response = await apiFetch('/jobs', {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          onSessionChange: setSession
        })
        if (!response.ok) throw new Error('Unable to load jobs')
        const payload = await response.json()
        if (active) setJobs(payload)
      } catch (error) {
        if (active) setJobsError(error.message || 'Unable to load jobs')
      } finally {
        if (active) setJobsLoading(false)
      }
    }
    loadJobs()
    return () => {
      active = false
    }
  }, [session])

  const clients = useMemo(() => buildClients(jobs), [jobs])

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase()
    if (!query) return clients
    return clients.filter((client) =>
      [client.name, client.phone, client.address].some((value) =>
        (value || '').toLowerCase().includes(query)
      )
    )
  }, [clients, clientSearch])

  const jobsByDate = useMemo(() => {
    const groupedJobs = new Map()

    jobs.forEach((job) => {
      const date = parseDateValue(job.job_date)
      if (!date) return
      const key = toDateKey(date)
      if (!groupedJobs.has(key)) groupedJobs.set(key, [])
      groupedJobs.get(key).push(job)
    })

    groupedJobs.forEach((group) => {
      group.sort((first, second) => {
        const firstTime = parseTimeToMinutes(first.start_time)
        const secondTime = parseTimeToMinutes(second.start_time)

        if (firstTime === null && secondTime === null) {
          return first.name.localeCompare(second.name)
        }

        if (firstTime === null) return 1
        if (secondTime === null) return -1

        return firstTime - secondTime || first.name.localeCompare(second.name)
      })
    })

    return groupedJobs
  }, [jobs])

  const calendarToday = useMemo(() => startOfDay(new Date()), [])
  const calendarTodayKey = toDateKey(calendarToday)

  const refreshJobs = async () => {
    if (!session) return
    const response = await apiFetch('/jobs', {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      onSessionChange: setSession
    })
    if (response.ok) {
      setJobs(await response.json())
    }
  }

  const validateJobField = (name, value) => {
    switch (name) {
      case 'name':
        return value.trim().length >= 2 ? '' : 'Enter the client name using at least 2 characters.'
      case 'phone': {
        const digits = value.replace(/\D/g, '')
        return digits.length >= 7 && digits.length <= 15 ? '' : 'Enter a phone number with 7 to 15 digits.'
      }
      case 'address':
        return value.trim().length >= 5 ? '' : 'Enter a fuller address so the job location is clear.'
      case 'jobType':
        return JOB_TYPE_OPTIONS.includes(value) ? '' : 'Choose one of the four supported job types.'
      case 'jobDate':
        return parseDateValue(value) ? '' : 'Pick a valid date for this appointment.'
      case 'startTime':
        return parseTimeValue(value) ? '' : 'Pick a valid start time for this appointment.'
      case 'payment':
        return !value || /^\d+(\.\d{0,2})?$/.test(value) ? '' : 'Enter a valid payment amount, for example 125 or 125.00.'
      case 'comments':
        return value.length <= 500 ? '' : 'Keep notes under 500 characters.'
      default:
        return ''
    }
  }

  const validateAuthField = (name, value, mode = authMode) => {
    const trimmed = String(value || '').trim()

    switch (name) {
      case 'username':
        if (!trimmed) {
          return mode === 'create'
            ? 'Choose a username before creating your account.'
            : 'Enter your email or username to sign in.'
        }
        if (mode === 'create' && trimmed.length < 3) {
          return 'Username must be at least 3 characters long.'
        }
        return ''
      case 'email':
        if (mode !== 'create') return ''
        if (!trimmed) return 'Enter an email address for the new account.'
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? '' : 'Enter a valid email address.'
      case 'password':
        if (!value) {
          return mode === 'create'
            ? 'Create a password for the new account.'
            : 'Enter your password to sign in.'
        }
        if (mode === 'create' && String(value).length < 8) {
          return 'Password must be at least 8 characters long.'
        }
        return ''
      case 'confirmPassword':
        if (mode !== 'create') return ''
        if (!value) return 'Re-enter the password to confirm it.'
        return value === authForm.password ? '' : 'The password confirmation does not match.'
      default:
        return ''
    }
  }

  const toFriendlyAuthError = (message, mode = authMode) => {
    const normalized = String(message || '').toLowerCase()

    if (normalized.includes('invalid credentials')) {
      return 'That email, username, or password did not match our records.'
    }
    if (normalized.includes('duplicate') || normalized.includes('already') || normalized.includes('taken')) {
      return mode === 'create'
        ? 'That username or email is already in use. Try a different one or sign in instead.'
        : 'That account already exists. Try signing in.'
    }
    if (normalized.includes('validation')) {
      return 'Some details need attention before we can continue.'
    }
    if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('reach server')) {
      return 'We could not reach the server. Check your connection and try again.'
    }

    return mode === 'create'
      ? 'We could not create the account with those details.'
      : 'We could not sign you in with those details.'
  }

  const toFriendlyJobError = (message) => {
    const normalized = String(message || '').toLowerCase()

    if (normalized.includes('validation')) {
      return 'Some appointment details need to be corrected before saving.'
    }
    if (normalized.includes('invalid') && normalized.includes('date')) {
      return 'Choose a valid appointment date before saving.'
    }
    if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('reach server')) {
      return 'We could not reach the server. Check your connection and try again.'
    }

    return 'We could not save this appointment. Review the details and try again.'
  }

  const submitAuth = async () => {
    const isCreate = authMode === 'create'
    const nextAuthErrors = Object.keys(authForm).reduce((accumulator, key) => {
      const error = validateAuthField(key, authForm[key], authMode)
      if (error) accumulator[key] = error
      return accumulator
    }, {})

    setAuthErrors(nextAuthErrors)
    if (Object.keys(nextAuthErrors).length > 0) {
      setAuthStatus({ type: 'error', message: isCreate ? 'Please fix the highlighted account details.' : 'Please fix the highlighted sign-in details.' })
      return
    }

    setAuthSubmitting(true)
    setAuthStatus(null)
    try {
      if (isCreate) {
        const response = await fetch(`${API_BASE}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authForm.username,
            email: authForm.email,
            password: authForm.password
          })
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to create account')
        setAuthMode('login')
        setAuthErrors({})
        setAuthStatus({ type: 'success', message: payload.message || 'Account created' })
      } else {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usernameOrEmail: authForm.username,
            password: authForm.password
          })
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || payload.errors?.[0]?.msg || 'Invalid credentials')
        const nextSession = buildSessionRecord({
          user: payload.user,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken
        })
        if (!nextSession) throw new Error('Login succeeded but mobile session data was incomplete')
        setSession(nextSession)
        setActiveTab('calendar')
      }
    } catch (error) {
      setAuthStatus({ type: 'error', message: toFriendlyAuthError(error.message, authMode) })
    } finally {
      setAuthSubmitting(false)
    }
  }

  const submitJob = async () => {
    const nextErrors = Object.keys(jobForm).reduce((accumulator, key) => {
      const error = validateJobField(key, jobForm[key])
      if (error) accumulator[key] = error
      return accumulator
    }, {})
    setJobErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !session) {
      if (Object.keys(nextErrors).length > 0) {
        setJobStatus({ type: 'error', message: 'Please fix the highlighted appointment details.' })
      }
      return
    }

    setJobStatus({ type: 'info', message: 'Saving appointment...' })
    try {
      const response = await apiFetch('/jobs', {
        method: 'POST',
        body: JSON.stringify(buildJobPayload(jobForm)),
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        onSessionChange: setSession
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to create job')
      setJobForm(EMPTY_JOB_FORM)
      setJobSuggestionField(null)
      setJobStatus({ type: 'success', message: 'Job created successfully' })
      await clearJobDraft()
      setActiveTab('calendar')
      await refreshJobs()
    } catch (error) {
      setJobStatus({ type: 'error', message: toFriendlyJobError(error.message) })
    }
  }

  const logout = async () => {
    try {
      if (session?.refreshToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken })
        })
      }
    } catch {
      // Ignore logout cleanup failures.
    }
    setSession(null)
  }

  const saveJobUpdates = async (jobId, updates) => {
    if (!session) return

    const response = await apiFetch(`/jobs/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(buildJobPayload(updates)),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      onSessionChange: setSession
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to update job')
    }
    await refreshJobs()
  }

  const saveClientUpdates = async (client, updates) => {
    const primaryJobId = client?.jobs?.[0]?.id
    if (!primaryJobId) {
      throw new Error('Unable to update client')
    }

    await saveJobUpdates(primaryJobId, updates)
    setSelectedClient(null)
  }

  const deleteJob = async (jobId) => {
    if (!session) return

    const response = await apiFetch(`/jobs/${jobId}`, {
      method: 'DELETE',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      onSessionChange: setSession
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to delete job')
    }
    setSelectedJob(null)
    await refreshJobs()
  }

  const confirmDeleteJob = (job) => {
    Alert.alert(
      'Delete job?',
      `This will permanently remove the ${job.job_type} job for ${job.name}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteJob(job.id)
            } catch (error) {
              Alert.alert('Unable to delete job', error.message || 'Please try again.')
            }
          }
        }
      ]
    )
  }

  const stepCalendar = (direction) => {
    setCalendarAnchorDate((current) => {
      if (calendarView === 'day') return addDays(current, direction)
      if (calendarView === 'week') return addDays(current, direction * 7)
      if (calendarView === 'month') return new Date(current.getFullYear(), current.getMonth() + direction, 1)
      return new Date(current.getFullYear() + direction, 0, 1)
    })
  }

  const jumpCalendarToToday = () => {
    setCalendarAnchorDate(calendarToday)
    setCalendarView('day')
  }

  const renderCalendarJobCard = (job, compact = false) => {
    const palette = getJobTypeColors(job.job_type)

    return (
      <View
        key={job.id}
        style={[
          styles.calendarJobCard,
          {
            backgroundColor: palette.background,
            borderColor: palette.border
          }
        ]}
      >
        <View style={commonStyles.rowBetween}>
          <Pressable style={styles.inlineContentButton} onPress={() => setSelectedJob(job)}>
            <Text style={[styles.calendarJobTitle, { color: palette.text }]}>{job.name}</Text>
            <Text style={[styles.calendarJobType, { color: palette.text }]}>{formatTimeRange(job.start_time)}</Text>
            {!compact ? (
              <Text style={[styles.calendarJobMeta, { color: palette.text }]}>
                {job.address || '-'} | {formatCurrency(job.payment)}
              </Text>
            ) : null}
          </Pressable>
          <Pressable style={styles.calendarEditButton} onPress={() => setSelectedJob(job)}>
            <Text style={styles.inlineActionText}>Edit</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const renderCalendarTimelineJobCard = (item, timelineStartMinutes) => {
    const { job, startMinutes, endMinutes, columnIndex, columnCount } = item
    const palette = getJobTypeColors(job.job_type)
    const top = ((startMinutes - timelineStartMinutes) / 60) * DAY_TIMELINE_ROW_HEIGHT + 6
    const height = Math.max(((endMinutes - startMinutes) / 60) * DAY_TIMELINE_ROW_HEIGHT - 12, DAY_TIMELINE_MIN_CARD_HEIGHT)
    const width = `${100 / columnCount}%`
    const left = `${(100 / columnCount) * columnIndex}%`

    return (
      <Pressable
        key={job.id}
        style={[
          styles.calendarTimelineCard,
          {
            top,
            left,
            width,
            height,
            backgroundColor: palette.background,
            borderColor: palette.border
          }
        ]}
        onPress={() => setSelectedJob(job)}
      >
        <Pressable
          style={styles.calendarTimelineEditButton}
          onPress={() => setSelectedJob(job)}
        >
          <Text style={styles.calendarTimelineEditText}>Edit</Text>
        </Pressable>
        <Text style={[styles.calendarTimelineHeader, { color: palette.text }]} numberOfLines={1}>
          {job.name || 'No client'} | {formatDate(job.job_date)}
        </Text>
        <Text style={[styles.calendarTimelineAddress, { color: palette.text }]} numberOfLines={1}>
          {job.address || 'No address'}
        </Text>
        <Text style={[styles.calendarTimelineTime, { color: palette.text }]} numberOfLines={1}>
          {formatTimeRange(job.start_time)}
        </Text>
      </Pressable>
    )
  }

  const renderCalendarContent = () => {
    if (calendarView === 'day') {
      const dayJobs = jobsByDate.get(toDateKey(calendarAnchorDate)) || []
      const { scheduledJobs, unscheduledJobs, timelineStartMinutes, visibleHourCount, timeSlots } = buildDayTimeline(dayJobs)
      const timelineHeight = visibleHourCount * DAY_TIMELINE_ROW_HEIGHT

      return (
        <>
          <View style={styles.calendarHero}>
            <Text style={styles.calendarHeroWeekday}>{calendarAnchorDate.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
            <Text style={styles.calendarHeroDay}>{calendarAnchorDate.getDate()}</Text>
            <Text style={styles.calendarHeroMonth}>{calendarAnchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
          </View>
          <View style={commonStyles.panel}>
            <Text style={commonStyles.heading3}>Appointments for the day</Text>
            <Text style={commonStyles.text}>{dayJobs.length} scheduled job{dayJobs.length === 1 ? '' : 's'}</Text>
            {dayJobs.length === 0 ? (
              <View style={styles.calendarEmptyState}>
                <Text style={commonStyles.text}>No jobs are scheduled for this day.</Text>
              </View>
            ) : (
              <View style={styles.calendarTimelineShell}>
                <View style={styles.calendarTimelineTimeRail}>
                  {timeSlots.map((slotMinutes) => (
                    <Text key={`label-${slotMinutes}`} style={styles.calendarTimelineTimeLabel}>
                      {formatTimelineHourLabel(slotMinutes)}
                    </Text>
                  ))}
                </View>
                <View style={styles.calendarTimelineGridWrap}>
                  <View style={[styles.calendarTimelineGrid, { height: timelineHeight }]}>
                    {timeSlots.map((slotMinutes) => (
                      <View key={`row-${slotMinutes}`} style={styles.calendarTimelineRow} />
                    ))}
                    <View style={styles.calendarTimelineOverlay}>
                      {scheduledJobs.map((item) => renderCalendarTimelineJobCard(item, timelineStartMinutes))}
                    </View>
                  </View>
                </View>
              </View>
            )}
            {unscheduledJobs.length > 0 ? (
              <View style={styles.calendarUnscheduledBlock}>
                <Text style={commonStyles.muted}>No timeslot yet</Text>
                <View style={styles.calendarAgendaList}>
                  {unscheduledJobs.map((job) => renderCalendarJobCard(job, true))}
                </View>
              </View>
            ) : null}
          </View>
        </>
      )
    }

    if (calendarView === 'week') {
      const weekStart = startOfWeek(calendarAnchorDate)
      const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

      return weekDays.map((date) => {
        const dateKey = toDateKey(date)
        const dayJobs = jobsByDate.get(dateKey) || []

        return (
          <View key={dateKey} style={[commonStyles.panel, dateKey === calendarTodayKey ? styles.calendarPanelToday : null]}>
            <View style={styles.calendarSectionHeader}>
              <Text style={commonStyles.heading3}>{date.toLocaleDateString('en-US', { weekday: 'long' })}</Text>
              <View style={commonStyles.chip}>
                <Text style={commonStyles.chipText}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              </View>
            </View>
            {dayJobs.length === 0 ? (
              <Text style={commonStyles.text}>No jobs</Text>
            ) : (
              <View style={styles.calendarAgendaList}>
                {dayJobs.map((job) => renderCalendarJobCard(job, true))}
              </View>
            )}
          </View>
        )
      })
    }

    if (calendarView === 'month') {
      const monthDays = buildMonthGrid(calendarAnchorDate)
      const currentMonth = calendarAnchorDate.getMonth()

      return (
        <View style={styles.monthGrid}>
          {monthDays.map((date) => {
            const dateKey = toDateKey(date)
            const dayJobs = jobsByDate.get(dateKey) || []
            const palette = dayJobs[0] ? getJobTypeColors(dayJobs[0].job_type) : null

            return (
              <Pressable
                key={dateKey}
                style={[
                  styles.monthCell,
                  date.getMonth() !== currentMonth ? styles.monthCellOutside : null,
                  dateKey === calendarTodayKey ? styles.monthCellToday : null
                ]}
                onPress={() => {
                  setCalendarAnchorDate(date)
                  setCalendarView('day')
                }}
              >
                <Text style={styles.monthCellDay}>{date.getDate()}</Text>
                {dayJobs.length > 0 ? (
                  <>
                    <View style={[styles.monthCellDot, { backgroundColor: palette.background }]} />
                    <Text style={styles.monthCellCount}>{dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}</Text>
                  </>
                ) : (
                  <Text style={styles.monthCellCount}>Open</Text>
                )}
              </Pressable>
            )
          })}
        </View>
      )
    }

    const months = Array.from({ length: 12 }, (_, index) => new Date(calendarAnchorDate.getFullYear(), index, 1))

    return months.map((monthDate) => {
      const monthStart = startOfMonth(monthDate)
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
      const monthJobs = jobs.filter((job) => {
        const jobDate = parseDateValue(job.job_date)
        return jobDate && jobDate >= monthStart && jobDate <= monthEnd
      })

      return (
        <Pressable
          key={monthDate.toISOString()}
          style={commonStyles.panel}
          onPress={() => {
            setCalendarAnchorDate(monthDate)
            setCalendarView('month')
          }}
        >
          <View style={styles.calendarSectionHeader}>
            <Text style={commonStyles.heading3}>{monthDate.toLocaleDateString('en-US', { month: 'long' })}</Text>
            <View style={commonStyles.chip}>
              <Text style={commonStyles.chipText}>{monthJobs.length} jobs</Text>
            </View>
          </View>
          <View style={styles.yearLegendRow}>
            {JOB_TYPE_OPTIONS.map((jobType) => {
              const count = monthJobs.filter((job) => job.job_type === jobType).length
              if (count === 0) return null

              return (
                <View key={jobType} style={styles.yearLegendItem}>
                  <View style={[styles.yearLegendDot, { backgroundColor: getJobTypeColors(jobType).background }]} />
                  <Text style={commonStyles.text}>{jobType}: {count}</Text>
                </View>
              )
            })}
            {monthJobs.length === 0 ? <Text style={commonStyles.text}>No jobs scheduled.</Text> : null}
          </View>
        </Pressable>
      )
    })
  }

  const deleteClient = async (clientId) => {
    if (!session) return

    const response = await apiFetch(`/clients/${clientId}`, {
      method: 'DELETE',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      onSessionChange: setSession
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Client deletion is not available on the current backend yet. Restart or redeploy the backend and try again.')
      }
      throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to delete client')
    }

    setSelectedJob((current) => (current?.client_id === clientId ? null : current))
    await refreshJobs()
  }

  const confirmDeleteClient = (client) => {
    Alert.alert(
      'Delete client?',
      `This will permanently remove ${client.name} and delete ${client.jobs.length} related job${client.jobs.length === 1 ? '' : 's'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClient(client.id)
            } catch (error) {
              Alert.alert('Unable to delete client', error.message || 'Please try again.')
            }
          }
        }
      ]
    )
  }

  if (!ready) {
    return (
      <SafeAreaView style={commonStyles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={commonStyles.text}>Loading Appointment Assistant...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!session) {
    const isCreate = authMode === 'create'
    return (
      <SafeAreaView style={commonStyles.screen}>
        <StatusBar style="light" />
        <KeyboardAvoidingView style={styles.keyboardFrame} behavior={keyboardAvoidingBehavior}>
          <ScrollView
            contentContainerStyle={commonStyles.content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <Panel title="Appointment Assistant" subtitle="Appointment toolkit">
              <Text style={commonStyles.text}>
                Manage client appointments, track job details, and keep your schedule organized from one mobile workspace.
              </Text>
              <Text style={apiHealth.status === 'error' ? commonStyles.errorText : apiHealth.status === 'success' ? commonStyles.successText : commonStyles.text}>
                {apiHealth.message}
              </Text>
            </Panel>
            <View style={commonStyles.panel}>
              <View style={styles.tabs}>
                <Tab active={!isCreate} label="Login" onPress={() => {
                  setAuthMode('login')
                  setAuthErrors({})
                  setAuthStatus(null)
                }} />
                <Tab active={isCreate} label="Create account" onPress={() => {
                  setAuthMode('create')
                  setAuthErrors({})
                  setAuthStatus(null)
                }} />
              </View>
              <FormField label={isCreate ? 'Username' : 'Email or username'} value={authForm.username} onChangeText={(value) => {
                setAuthForm((current) => ({ ...current, username: value }))
                setAuthErrors((current) => ({ ...current, username: '' }))
                setAuthStatus(null)
              }} error={authErrors.username} />
              {isCreate ? <FormField label="Email" value={authForm.email} onChangeText={(value) => {
                setAuthForm((current) => ({ ...current, email: value }))
                setAuthErrors((current) => ({ ...current, email: '' }))
                setAuthStatus(null)
              }} error={authErrors.email} /> : null}
              <FormField label="Password" value={authForm.password} onChangeText={(value) => {
                setAuthForm((current) => ({ ...current, password: value }))
                setAuthErrors((current) => ({
                  ...current,
                  password: '',
                  confirmPassword: authMode === 'create' && authForm.confirmPassword && authForm.confirmPassword !== value
                    ? 'The password confirmation does not match.'
                    : ''
                }))
                setAuthStatus(null)
              }} error={authErrors.password} secureTextEntry />
              {isCreate ? <FormField label="Confirm password" value={authForm.confirmPassword} onChangeText={(value) => {
                setAuthForm((current) => ({ ...current, confirmPassword: value }))
                setAuthErrors((current) => ({ ...current, confirmPassword: '' }))
                setAuthStatus(null)
              }} error={authErrors.confirmPassword} secureTextEntry /> : null}
              <Pressable style={[commonStyles.button, commonStyles.buttonPrimary]} onPress={submitAuth}>
                <Text style={commonStyles.buttonText}>{authSubmitting ? 'Working...' : isCreate ? 'Create account' : 'Sign in'}</Text>
              </Pressable>
              {authStatus ? <Text style={authStatus.type === 'error' ? commonStyles.errorText : commonStyles.successText}>{authStatus.message}</Text> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={commonStyles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.keyboardFrame} behavior={keyboardAvoidingBehavior}>
        <ScrollView
          contentContainerStyle={commonStyles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Panel title={activeTab === 'jobs-new' ? 'Create a new job' : activeTab === 'jobs' ? 'Job dashboard' : activeTab === 'clients' ? 'Client relationships' : 'Calendar overview'} subtitle="Workspace overview">
            <Text style={commonStyles.text}>Signed in as {session.user?.name || session.user?.email || 'Workspace user'}.</Text>
            <Pressable style={[commonStyles.button, commonStyles.buttonSecondary]} onPress={logout}>
              <Text style={commonStyles.buttonText}>Logout</Text>
            </Pressable>
          </Panel>
          <View style={commonStyles.panel}>
            <Text style={commonStyles.muted}>Navigation</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.navRow}>{NAV_ITEMS.map((item) => <Chip key={item.key} active={activeTab === item.key} label={item.label} onPress={() => setActiveTab(item.key)} />)}</View>
            </ScrollView>
          </View>

          {activeTab === 'jobs' ? (
            <>
              <Panel title="All jobs">
                <Text style={commonStyles.text}>Each appointment becomes its own card so the desktop table translates cleanly to mobile.</Text>
                <View style={commonStyles.chip}><Text style={commonStyles.chipText}>Total payments {formatCurrency(jobs.reduce((sum, job) => sum + (Number(job.payment) || 0), 0))}</Text></View>
              </Panel>
              {jobsLoading ? <Panel><Text style={commonStyles.text}>Loading jobs...</Text></Panel> : null}
              {jobsError ? <Panel><Text style={commonStyles.errorText}>{jobsError}</Text></Panel> : null}
              {!jobsLoading && !jobsError ? jobs.map((job) => <JobCard key={job.id} job={job} onPress={() => setSelectedJob(job)} onDelete={() => confirmDeleteJob(job)} />) : null}
            </>
          ) : null}

          {activeTab === 'jobs-new' ? (
            <View style={commonStyles.panel}>
              <Text style={commonStyles.sectionTitle}>Appointment details</Text>
              <FormField label="Client name" value={jobForm.name} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, name: value }))
                setJobErrors((current) => ({ ...current, name: '' }))
                setJobStatus(null)
                setJobSuggestionField('name')
              }} error={jobErrors.name} placeholder="Jane Smith" />
              <ClientSuggestions
                clients={clients}
                query={jobForm.name}
                field="name"
                visible={jobSuggestionField === 'name'}
                onSelect={(client) => {
                  setJobForm((current) => ({ ...current, ...applyClientDetails(client) }))
                  setJobSuggestionField(null)
                  setJobErrors((current) => ({ ...current, name: '', phone: '', address: '' }))
                  setJobStatus(null)
                }}
              />
              <FormField label="Phone" value={jobForm.phone} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, phone: normalizePhoneDigits(value) }))
                setJobErrors((current) => ({ ...current, phone: '' }))
                setJobStatus(null)
                setJobSuggestionField('phone')
              }} error={jobErrors.phone} keyboardType="phone-pad" maxLength={15} placeholder={PHONE_EXAMPLE} helperText={`Enter digits only. Preview: ${formatPhonePreview(jobForm.phone)}`} />
              <ClientSuggestions
                clients={clients}
                query={jobForm.phone}
                field="phone"
                visible={jobSuggestionField === 'phone'}
                onSelect={(client) => {
                  setJobForm((current) => ({ ...current, ...applyClientDetails(client) }))
                  setJobSuggestionField(null)
                  setJobErrors((current) => ({ ...current, name: '', phone: '', address: '' }))
                  setJobStatus(null)
                }}
              />
              <FormField label="Address" value={jobForm.address} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, address: value }))
                setJobErrors((current) => ({ ...current, address: '' }))
                setJobStatus(null)
                setJobSuggestionField('address')
              }} error={jobErrors.address} placeholder="123 Main St, Springfield, IL 62704" helperText="Include street, city, and any unit details so the crew can find the appointment quickly." />
              <ClientSuggestions
                clients={clients}
                query={jobForm.address}
                field="address"
                visible={jobSuggestionField === 'address'}
                onSelect={(client) => {
                  setJobForm((current) => ({ ...current, ...applyClientDetails(client) }))
                  setJobSuggestionField(null)
                  setJobErrors((current) => ({ ...current, name: '', phone: '', address: '' }))
                  setJobStatus(null)
                }}
              />
              <SelectField label="Job type" value={jobForm.jobType} onChange={(value) => {
                setJobForm((current) => ({ ...current, jobType: value }))
                setJobErrors((current) => ({ ...current, jobType: '' }))
                setJobStatus(null)
              }} error={jobErrors.jobType} options={JOB_TYPE_OPTIONS} />
              <DateField label="Date" value={jobForm.jobDate} onChange={(value) => {
                setJobForm((current) => ({ ...current, jobDate: value }))
                setJobErrors((current) => ({ ...current, jobDate: '' }))
                setJobStatus(null)
              }} error={jobErrors.jobDate} />
              <TimeField label="Start time" value={jobForm.startTime} onChange={(value) => {
                setJobForm((current) => ({ ...current, startTime: value }))
                setJobErrors((current) => ({ ...current, startTime: '' }))
                setJobStatus(null)
              }} error={jobErrors.startTime} />
              <CurrencyField label="Payment" value={jobForm.payment} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, payment: value }))
                setJobErrors((current) => ({ ...current, payment: '' }))
                setJobStatus(null)
              }} error={jobErrors.payment} placeholder="0.00" />
              <FormField label="Comments" value={jobForm.comments} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, comments: value }))
                setJobErrors((current) => ({ ...current, comments: '' }))
                setJobStatus(null)
              }} error={jobErrors.comments} multiline placeholder="Gate code 2468. Park in driveway. Customer prefers afternoon arrival." helperText="Add gate codes, parking notes, scope details, or anything the team should know before arrival." />
              {jobStatus ? <Text style={jobStatus.type === 'error' ? commonStyles.errorText : jobStatus.type === 'success' ? commonStyles.successText : commonStyles.text}>{jobStatus.message}</Text> : null}
              <Pressable style={[commonStyles.button, commonStyles.buttonPrimary]} onPress={submitJob}><Text style={commonStyles.buttonText}>Save appointment</Text></Pressable>
            </View>
          ) : null}

          {activeTab === 'clients' ? (
            <>
              <View style={commonStyles.panel}>
                <Text style={commonStyles.sectionTitle}>Clients</Text>
                <TextInput style={commonStyles.input} value={clientSearch} onChangeText={setClientSearch} placeholder="Search by name, phone, or address" placeholderTextColor={colors.textMuted} />
              </View>
              {filteredClients.map((client) => (
                <View key={client.id} style={commonStyles.panel}>
                  <View style={commonStyles.rowBetween}>
                    <Text style={commonStyles.heading3}>{client.name}</Text>
                    <View style={styles.cardActionRow}>
                      <Pressable style={[styles.inlineActionButton, styles.inlineEditButton]} onPress={() => setSelectedClient(client)}>
                        <Text style={styles.inlineActionText}>Edit</Text>
                      </Pressable>
                      <Pressable style={styles.iconDeleteButton} onPress={() => confirmDeleteClient(client)}>
                        <Text style={styles.iconDeleteText}>X</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text style={commonStyles.text}>{client.phone || '-'} | {client.address || '-'}</Text>
                  <View style={commonStyles.chip}><Text style={commonStyles.chipText}>{client.jobs.length} jobs - {formatCurrency(client.totalPayments)}</Text></View>
                  {client.jobs.map((job) => (
                    <View key={job.id} style={styles.inlineCard}>
                      <View style={commonStyles.rowBetween}>
                        <Pressable style={styles.inlineContentButton} onPress={() => setSelectedJob(job)}>
                          <Text style={styles.inlineTitle}>{job.job_type}</Text>
                          <Text style={commonStyles.text}>{formatDate(job.job_date)}</Text>
                        </Pressable>
                        <View style={styles.cardActionRow}>
                          <View style={styles.statusActionChip}><Text style={commonStyles.chipText}>{job.status}</Text></View>
                          <Pressable style={[styles.inlineActionButton, styles.inlineEditButton]} onPress={() => setSelectedJob(job)}>
                            <Text style={styles.inlineActionText}>Edit</Text>
                          </Pressable>
                          <Pressable style={styles.iconDeleteButton} onPress={() => confirmDeleteJob(job)}>
                            <Text style={styles.iconDeleteText}>X</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : null}

          {activeTab === 'calendar' ? (
            <>
              <View style={commonStyles.panel}>
                <Text style={commonStyles.sectionTitle}>Job calendar</Text>
                <Text style={commonStyles.text}>Switch between daily, weekly, monthly, and yearly views. Mobile opens on the daily schedule.</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.calendarViewTabs}>
                    {CALENDAR_VIEWS.map((view) => (
                      <Tab
                        key={view.key}
                        label={view.label}
                        active={calendarView === view.key}
                        onPress={() => setCalendarView(view.key)}
                      />
                    ))}
                  </View>
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.calendarControls}>
                    <Chip label="Previous" onPress={() => stepCalendar(-1)} />
                    <Chip label="Today" active onPress={jumpCalendarToToday} />
                    <Chip label="Next" onPress={() => stepCalendar(1)} />
                  </View>
                </ScrollView>
                <Text style={commonStyles.heading3}>{getCalendarRangeLabel(calendarView, calendarAnchorDate)}</Text>
                <View style={styles.calendarLegend}>
                  {JOB_TYPE_OPTIONS.map((jobType) => (
                    <View key={jobType} style={styles.calendarLegendItem}>
                      <View style={[styles.calendarLegendSwatch, { backgroundColor: getJobTypeColors(jobType).background }]} />
                      <Text style={styles.calendarLegendText}>{jobType}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {renderCalendarContent()}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <JobModal job={selectedJob} clients={clients} onClose={() => setSelectedJob(null)} onSave={saveJobUpdates} onDelete={confirmDeleteJob} />
      <ClientModal client={selectedClient} clients={clients} onClose={() => setSelectedClient(null)} onSave={saveClientUpdates} />
    </SafeAreaView>
  )
}

function Panel({ title, subtitle, children }) {
  return (
    <View style={commonStyles.panel}>
      {subtitle ? <Text style={commonStyles.muted}>{subtitle}</Text> : null}
      {title ? <Text style={commonStyles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  )
}

function FormField({ label, error, helperText, multiline, ...props }) {
  return (
    <View>
      <Text style={commonStyles.label}>{label}</Text>
      <TextInput style={[commonStyles.input, multiline ? styles.multiline : null]} placeholderTextColor={colors.textMuted} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} {...props} />
      {helperText ? <Text style={commonStyles.helperText}>{helperText}</Text> : null}
      {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}
    </View>
  )
}

function ClientSuggestions({ clients, query, field, visible, onSelect }) {
  const matches = visible ? getClientSuggestions(clients, query, field).slice(0, 6) : []

  if (!visible || matches.length === 0) return null

  return (
    <View style={styles.suggestionBox}>
      {matches.map((client, index) => (
        <Pressable
          key={client.id ?? `${client.name || 'client'}-${client.phone || ''}-${client.address || ''}-${index}`}
          onPress={() => onSelect(client)}
          style={({ pressed }) => [
            styles.suggestionItem,
            index === matches.length - 1 ? styles.suggestionItemLast : null,
            pressed ? styles.suggestionItemPressed : null
          ]}
        >
          <Text style={styles.suggestionName} numberOfLines={1}>
            {client.name || 'No name'}
          </Text>
          <Text style={styles.suggestionMeta} numberOfLines={1}>
            {formatPhonePreview(client.phone)}
          </Text>
          <Text style={styles.suggestionMeta} numberOfLines={1}>
            {client.address || 'No address'}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

function CurrencyField({ label, error, ...props }) {
  return (
    <View>
      <Text style={commonStyles.label}>{label}</Text>
      <View style={styles.currencyField}>
        <Text style={styles.currencySymbol}>$</Text>
        <TextInput
          style={styles.currencyInput}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          {...props}
        />
      </View>
      {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}
    </View>
  )
}

function DateField({ label, value, onChange, error }) {
  const [iosPickerVisible, setIosPickerVisible] = useState(false)
  const [iosDraftDate, setIosDraftDate] = useState(() => parseDateValue(value) || new Date())

  useEffect(() => {
    if (!iosPickerVisible) {
      setIosDraftDate(parseDateValue(value) || new Date())
    }
  }, [iosPickerVisible, value])

  const openPicker = () => {
    const selectedDate = parseDateValue(value) || new Date()

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        onChange: (event, nextDate) => {
          if (event.type === 'set' && nextDate) {
            onChange(formatDateValue(nextDate))
          }
        }
      })
      return
    }

    setIosDraftDate(selectedDate)
    setIosPickerVisible(true)
  }

  const confirmIosDate = () => {
    onChange(formatDateValue(iosDraftDate))
    setIosPickerVisible(false)
  }

  return (
    <View>
      <Text style={commonStyles.label}>{label}</Text>
      <Pressable style={[commonStyles.input, styles.dateField]} onPress={openPicker}>
        <Text style={value ? styles.dateFieldText : styles.dateFieldPlaceholder}>
          {value ? formatDate(value) : 'Select a date'}
        </Text>
        <Text style={styles.dateFieldHint}>{value || 'YYYY-MM-DD'}</Text>
      </Pressable>
      {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}

      {Platform.OS === 'ios' && iosPickerVisible ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setIosPickerVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.dateModalPanel}>
              <Text style={commonStyles.sectionTitle}>Choose a date</Text>
              <DateTimePicker
                value={iosDraftDate}
                mode="date"
                display="spinner"
                onChange={(_, nextDate) => {
                  if (nextDate) setIosDraftDate(nextDate)
                }}
              />
              <View style={styles.modalActions}>
                <Pressable style={[commonStyles.button, commonStyles.buttonSecondary, styles.modalAction]} onPress={() => setIosPickerVisible(false)}>
                  <Text style={commonStyles.buttonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[commonStyles.button, commonStyles.buttonPrimary, styles.modalAction]} onPress={confirmIosDate}>
                  <Text style={commonStyles.buttonText}>Use date</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

function SelectField({ label, value, onChange, error, options }) {
  const [visible, setVisible] = useState(false)

  return (
    <View>
      <Text style={commonStyles.label}>{label}</Text>
      <Pressable style={[commonStyles.input, styles.dateField]} onPress={() => setVisible(true)}>
        <Text style={value ? styles.dateFieldText : styles.dateFieldPlaceholder}>
          {value || 'Choose an option'}
        </Text>
      </Pressable>
      {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.dateModalPanel}>
            <Text style={commonStyles.sectionTitle}>Choose {label.toLowerCase()}</Text>
            <View style={styles.optionList}>
              {options.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.optionRow, value === option ? styles.optionRowActive : null]}
                  onPress={() => {
                    onChange(option)
                    setVisible(false)
                  }}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[commonStyles.button, commonStyles.buttonSecondary]} onPress={() => setVisible(false)}>
              <Text style={commonStyles.buttonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function Tab({ active, label, onPress }) {
  return <Chip label={label} active={active} onPress={onPress} />
}

function Chip({ active, label, onPress, grow }) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipActive : null, grow ? styles.chipGrow : null]} onPress={onPress}>
      <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </Pressable>
  )
}

function TimeField({ label, value, onChange, error }) {
  const [iosPickerVisible, setIosPickerVisible] = useState(false)
  const parsedValue = parseTimeValue(value)
  const [iosDraftTime, setIosDraftTime] = useState(() => new Date(2000, 0, 1, parsedValue?.hours ?? 9, parsedValue?.minutes ?? 0))

  useEffect(() => {
    if (!iosPickerVisible) {
      const nextParsedValue = parseTimeValue(value)
      setIosDraftTime(new Date(2000, 0, 1, nextParsedValue?.hours ?? 9, nextParsedValue?.minutes ?? 0))
    }
  }, [iosPickerVisible, value])

  const openPicker = () => {
    const nextParsedValue = parseTimeValue(value)
    const selectedTime = new Date(2000, 0, 1, nextParsedValue?.hours ?? 9, nextParsedValue?.minutes ?? 0)

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedTime,
        mode: 'time',
        is24Hour: false,
        onChange: (event, nextDate) => {
          if (event.type === 'set' && nextDate) {
            onChange(`${String(nextDate.getHours()).padStart(2, '0')}:${String(nextDate.getMinutes()).padStart(2, '0')}`)
          }
        }
      })
      return
    }

    setIosDraftTime(selectedTime)
    setIosPickerVisible(true)
  }

  const confirmIosTime = () => {
    onChange(`${String(iosDraftTime.getHours()).padStart(2, '0')}:${String(iosDraftTime.getMinutes()).padStart(2, '0')}`)
    setIosPickerVisible(false)
  }

  return (
    <View>
      <Text style={commonStyles.label}>{label}</Text>
      <Pressable style={[commonStyles.input, styles.dateField]} onPress={openPicker}>
        <Text style={value ? styles.dateFieldText : styles.dateFieldPlaceholder}>
          {value ? formatTimeRange(value) : 'Select a start time'}
        </Text>
        <Text style={styles.dateFieldHint}>{value || 'HH:MM'}</Text>
      </Pressable>
      <Text style={commonStyles.helperText}>Each job reserves one hour starting at this time.</Text>
      {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}

      {Platform.OS === 'ios' && iosPickerVisible ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setIosPickerVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.dateModalPanel}>
              <Text style={commonStyles.sectionTitle}>Choose a start time</Text>
              <DateTimePicker
                value={iosDraftTime}
                mode="time"
                display="spinner"
                onChange={(_, nextDate) => {
                  if (nextDate) setIosDraftTime(nextDate)
                }}
              />
              <View style={styles.modalActions}>
                <Pressable style={[commonStyles.button, commonStyles.buttonSecondary, styles.modalAction]} onPress={() => setIosPickerVisible(false)}>
                  <Text style={commonStyles.buttonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[commonStyles.button, commonStyles.buttonPrimary, styles.modalAction]} onPress={confirmIosTime}>
                  <Text style={commonStyles.buttonText}>Use time</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

function JobCard({ job, onPress, onDelete }) {
  return (
    <View style={commonStyles.panel}>
      <View style={commonStyles.rowBetween}>
        <Pressable style={styles.jobCardContent} onPress={onPress}>
          <Text style={commonStyles.heading3}>{job.name}</Text>
        </Pressable>
        <View style={styles.jobCardActions}>
          <View style={styles.cardActionRow}>
            <View style={styles.statusActionChip}><Text style={commonStyles.chipText}>{job.status}</Text></View>
            <Pressable style={[styles.inlineActionButton, styles.inlineEditButton]} onPress={onPress}>
              <Text style={styles.inlineActionText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.iconDeleteButton} onPress={onDelete}>
              <Text style={styles.iconDeleteText}>X</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <Pressable style={styles.jobCardContent} onPress={onPress}>
        <Text style={commonStyles.text}>{formatDate(job.job_date)}</Text>
        <Text style={commonStyles.text}>{formatTimeRange(job.start_time)}</Text>
        <Text style={commonStyles.text}>{job.job_type}</Text>
        <Text style={commonStyles.text}>{job.phone || '-'}</Text>
        <Text style={commonStyles.text}>{job.address || '-'}</Text>
        <Text style={commonStyles.text}>Payment: {formatCurrency(job.payment)}</Text>
        <Text style={commonStyles.text}>{job.comments || 'No notes yet'}</Text>
      </Pressable>
    </View>
  )
}

function ClientModal({ client, clients, onClose, onSave }) {
  const [formState, setFormState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suggestionField, setSuggestionField] = useState(null)

  useEffect(() => {
    if (!client) {
      setFormState(null)
      setSaving(false)
      setError('')
      setSuggestionField(null)
      return
    }

    setFormState({
      name: client.name || '',
      phone: client.phone || '',
      address: client.address || ''
    })
    setSuggestionField(null)
  }, [client])

  if (!client) return null

  const handleSave = async () => {
    if (!formState) return
    setSaving(true)
    setError('')

    try {
      await onSave(client, formState)
    } catch (nextError) {
      setError(nextError.message || 'Unable to update client')
      setSaving(false)
      return
    }

    setSaving(false)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView style={styles.keyboardFrame} behavior={keyboardAvoidingBehavior}>
          <View style={styles.modalPanel}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <Text style={commonStyles.sectionTitle}>Edit client</Text>
              <Text style={commonStyles.text}>Update the client details used across this client&apos;s jobs.</Text>
              <FormField label="Client name" value={formState?.name || ''} onChangeText={(value) => {
                setFormState((current) => ({ ...current, name: value }))
                setSuggestionField('name')
              }} placeholder="Jane Smith" />
              <ClientSuggestions
                clients={clients}
                query={formState?.name || ''}
                field="name"
                visible={suggestionField === 'name'}
                onSelect={(client) => {
                  setFormState((current) => ({ ...current, ...applyClientDetails(client) }))
                  setSuggestionField(null)
                }}
              />
              <FormField label="Phone" value={formState?.phone || ''} onChangeText={(value) => {
                setFormState((current) => ({ ...current, phone: normalizePhoneDigits(value) }))
                setSuggestionField('phone')
              }} keyboardType="phone-pad" maxLength={15} placeholder={PHONE_EXAMPLE} helperText={`Enter digits only. Preview: ${formatPhonePreview(formState?.phone || '')}`} />
              <ClientSuggestions
                clients={clients}
                query={formState?.phone || ''}
                field="phone"
                visible={suggestionField === 'phone'}
                onSelect={(client) => {
                  setFormState((current) => ({ ...current, ...applyClientDetails(client) }))
                  setSuggestionField(null)
                }}
              />
              <FormField label="Address" value={formState?.address || ''} onChangeText={(value) => {
                setFormState((current) => ({ ...current, address: value }))
                setSuggestionField('address')
              }} placeholder="123 Main St, Springfield, IL 62704" helperText="Include street, city, and any unit details so the crew can find the appointment quickly." />
              <ClientSuggestions
                clients={clients}
                query={formState?.address || ''}
                field="address"
                visible={suggestionField === 'address'}
                onSelect={(client) => {
                  setFormState((current) => ({ ...current, ...applyClientDetails(client) }))
                  setSuggestionField(null)
                }}
              />
              {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable style={[commonStyles.button, commonStyles.buttonSecondary, styles.modalAction]} onPress={onClose}>
                  <Text style={commonStyles.buttonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[commonStyles.button, commonStyles.buttonPrimary, styles.modalAction]} onPress={handleSave} disabled={saving}>
                  <Text style={commonStyles.buttonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

function JobModal({ job, clients, onClose, onSave, onDelete }) {
  const [formState, setFormState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suggestionField, setSuggestionField] = useState(null)

  useEffect(() => {
    if (!job) {
      setFormState(null)
      setSaving(false)
      setError('')
      setSuggestionField(null)
      return
    }

    setFormState({
      name: job.name || '',
      phone: job.phone || '',
      address: job.address || '',
      jobType: job.job_type || '',
      jobDate: formatDateValue(job.job_date),
      startTime: formatTimeValue(job.start_time),
      payment: job.payment === null || job.payment === undefined ? '' : String(job.payment),
      comments: job.comments || '',
      status: job.status || 'Pending'
    })
    setSuggestionField(null)
  }, [job])

  if (!job) return null

  const handleSave = async () => {
    if (!formState) return
    setSaving(true)
    setError('')

    try {
      await onSave(job.id, formState)
      onClose()
    } catch (nextError) {
      setError(nextError.message || 'Unable to update job')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView style={styles.keyboardFrame} behavior={keyboardAvoidingBehavior}>
          <View style={styles.modalPanel}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <Text style={commonStyles.sectionTitle}>Edit job</Text>
              <Text style={commonStyles.text}>Update client details, status, payment, and notes from this mobile sheet.</Text>
              <FormField label="Client name" value={formState?.name || ''} onChangeText={(value) => {
                setFormState((current) => ({ ...current, name: value }))
                setSuggestionField('name')
              }} placeholder="Jane Smith" />
              <ClientSuggestions
                clients={clients}
                query={formState?.name || ''}
                field="name"
                visible={suggestionField === 'name'}
                onSelect={(client) => {
                  setFormState((current) => ({ ...current, ...applyClientDetails(client) }))
                  setSuggestionField(null)
                }}
              />
              <FormField label="Phone" value={formState?.phone || ''} onChangeText={(value) => {
                setFormState((current) => ({ ...current, phone: normalizePhoneDigits(value) }))
                setSuggestionField('phone')
              }} keyboardType="phone-pad" maxLength={15} placeholder={PHONE_EXAMPLE} helperText={`Enter digits only. Preview: ${formatPhonePreview(formState?.phone || '')}`} />
              <ClientSuggestions
                clients={clients}
                query={formState?.phone || ''}
                field="phone"
                visible={suggestionField === 'phone'}
                onSelect={(client) => {
                  setFormState((current) => ({ ...current, ...applyClientDetails(client) }))
                  setSuggestionField(null)
                }}
              />
              <FormField label="Address" value={formState?.address || ''} onChangeText={(value) => {
                setFormState((current) => ({ ...current, address: value }))
                setSuggestionField('address')
              }} placeholder="123 Main St, Springfield, IL 62704" helperText="Include street, city, and any unit details so the crew can find the appointment quickly." />
              <ClientSuggestions
                clients={clients}
                query={formState?.address || ''}
                field="address"
                visible={suggestionField === 'address'}
                onSelect={(client) => {
                  setFormState((current) => ({ ...current, ...applyClientDetails(client) }))
                  setSuggestionField(null)
                }}
              />
              <SelectField label="Job type" value={formState?.jobType || ''} onChange={(value) => setFormState((current) => ({ ...current, jobType: value }))} options={JOB_TYPE_OPTIONS} />
              <DateField label="Date" value={formState?.jobDate || ''} onChange={(value) => setFormState((current) => ({ ...current, jobDate: value }))} />
              <TimeField label="Start time" value={formState?.startTime || ''} onChange={(value) => setFormState((current) => ({ ...current, startTime: value }))} />
              <SelectField label="Status" value={formState?.status || ''} onChange={(value) => setFormState((current) => ({ ...current, status: value }))} options={JOB_STATUS_OPTIONS} />
              <CurrencyField label="Payment" value={formState?.payment || ''} onChangeText={(value) => setFormState((current) => ({ ...current, payment: value }))} placeholder="0.00" />
              <FormField label="Comments" value={formState?.comments || ''} onChangeText={(value) => setFormState((current) => ({ ...current, comments: value }))} multiline placeholder="Gate code 2468. Park in driveway. Customer prefers afternoon arrival." helperText="Add gate codes, parking notes, scope details, or anything the team should know before arrival." />
              {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable style={[commonStyles.button, commonStyles.buttonSecondary, styles.modalAction]} onPress={onClose}>
                  <Text style={commonStyles.buttonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[commonStyles.button, commonStyles.buttonPrimary, styles.modalAction]} onPress={handleSave} disabled={saving}>
                  <Text style={commonStyles.buttonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
                </Pressable>
              </View>
              <Pressable style={[commonStyles.button, styles.deleteButton]} onPress={() => onDelete?.(job)} disabled={saving}>
                <Text style={commonStyles.buttonText}>Delete job</Text>
              </Pressable>
              <View style={commonStyles.chip}>
                <Text style={commonStyles.chipText}>Original slot {formatDate(job.job_date)} | {formatTimeRange(job.start_time)}</Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  keyboardFrame: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  tabs: { flexDirection: 'row', gap: 8 },
  navRow: { flexDirection: 'row', gap: 10, paddingRight: 8 },
  chip: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0
  },
  chipActive: { backgroundColor: 'rgba(109, 124, 255, 0.18)', borderColor: colors.borderStrong },
  chipGrow: { flex: 1 },
  chipText: { color: colors.heading, fontWeight: '700', fontSize: 13 },
  currencyField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingLeft: 14
  },
  currencySymbol: {
    color: colors.heading,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8
  },
  currencyInput: {
    flex: 1,
    color: colors.heading,
    paddingRight: 14,
    paddingVertical: 14,
    fontSize: 15
  },
  dateField: { gap: 6 },
  dateFieldText: { color: colors.heading, fontSize: 15 },
  dateFieldPlaceholder: { color: colors.textMuted, fontSize: 15 },
  dateFieldHint: { color: colors.textMuted, fontSize: 12 },
  dateModalPanel: {
    margin: 20,
    marginTop: 'auto',
    backgroundColor: colors.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16
  },
  optionList: { gap: 10 },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border
  },
  optionRowActive: {
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(109, 124, 255, 0.14)'
  },
  optionText: {
    color: colors.heading,
    fontSize: 15,
    fontWeight: '700'
  },
  jobCardContent: { gap: 6 },
  jobCardActions: {
    alignItems: 'flex-start',
    gap: 8
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  inlineActionButton: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  inlineDeleteButton: {
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
    borderColor: 'rgba(251, 113, 133, 0.4)'
  },
  inlineEditButton: {
    backgroundColor: 'rgba(109, 124, 255, 0.12)',
    borderColor: colors.borderStrong
  },
  statusActionChip: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109, 124, 255, 0.14)',
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  suggestionBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.panel
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card
  },
  suggestionItemLast: {
    borderBottomWidth: 0
  },
  suggestionItemPressed: {
    backgroundColor: 'rgba(109, 124, 255, 0.14)'
  },
  suggestionName: {
    color: colors.heading,
    fontSize: 14,
    fontWeight: '800'
  },
  suggestionMeta: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  inlineActionText: {
    color: colors.heading,
    fontSize: 12,
    fontWeight: '700'
  },
  iconDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.4)'
  },
  iconDeleteText: {
    color: colors.heading,
    fontSize: 12,
    fontWeight: '800'
  },
  inlineContentButton: {
    flex: 1,
    gap: 6
  },
  multiline: { minHeight: 120 },
  inlineCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.card, padding: 14, gap: 6 },
  inlineTitle: { color: colors.heading, fontWeight: '700', fontSize: 16 },
  calendarViewTabs: { flexDirection: 'row', gap: 10, paddingRight: 8 },
  calendarControls: { flexDirection: 'row', gap: 10, paddingRight: 8 },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  calendarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexShrink: 0
  },
  calendarLegendSwatch: { width: 10, height: 10, borderRadius: 999 },
  calendarLegendText: { color: colors.heading, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  calendarHero: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panel,
    padding: 22,
    alignItems: 'center',
    gap: 8
  },
  calendarHeroWeekday: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  calendarHeroDay: { color: colors.heading, fontSize: 68, fontWeight: '800', lineHeight: 72 },
  calendarHeroMonth: { color: colors.text, fontSize: 16, fontWeight: '700' },
  calendarEmptyState: {
    marginTop: 12,
    minHeight: 120,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  calendarTimelineShell: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch'
  },
  calendarTimelineTimeRail: {
    width: 58,
    paddingTop: 6,
    gap: 0
  },
  calendarTimelineTimeLabel: {
    height: DAY_TIMELINE_ROW_HEIGHT,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  calendarTimelineGridWrap: {
    flex: 1,
    minWidth: 0
  },
  calendarTimelineGrid: {
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.card
  },
  calendarTimelineRow: {
    height: DAY_TIMELINE_ROW_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)'
  },
  calendarTimelineOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  calendarTimelineCard: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-start'
  },
  calendarTimelineEditButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    zIndex: 2
  },
  calendarTimelineEditText: {
    color: colors.heading,
    fontSize: 11,
    fontWeight: '800'
  },
  calendarTimelineHeader: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800'
  },
  calendarTimelineAddress: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    marginTop: 2
  },
  calendarTimelineTime: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    marginTop: 2
  },
  calendarAgendaList: { gap: 12, marginTop: 12 },
  calendarUnscheduledBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10
  },
  calendarJobCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8
  },
  calendarJobTitle: { fontSize: 16, fontWeight: '800' },
  calendarJobType: { fontSize: 13, fontWeight: '700' },
  calendarJobMeta: { fontSize: 12, lineHeight: 18 },
  calendarEditButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)'
  },
  calendarSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  calendarPanelToday: {
    borderColor: colors.borderStrong
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  monthCell: {
    width: '22%',
    minWidth: 70,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.panel,
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 8
  },
  monthCellOutside: {
    opacity: 0.45
  },
  monthCellToday: {
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(109, 124, 255, 0.12)'
  },
  monthCellDay: { color: colors.heading, fontSize: 18, fontWeight: '800' },
  monthCellDot: { width: 10, height: 10, borderRadius: 999 },
  monthCellCount: { color: colors.text, fontSize: 12, fontWeight: '700' },
  yearLegendRow: { gap: 10 },
  yearLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearLegendDot: { width: 10, height: 10, borderRadius: 999 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.8)' },
  modalPanel: { maxHeight: '85%', backgroundColor: colors.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.border },
  modalContent: { padding: 20, gap: 14 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalAction: { flex: 1 },
  deleteButton: {
    backgroundColor: 'rgba(251, 113, 133, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.4)'
  }
})
