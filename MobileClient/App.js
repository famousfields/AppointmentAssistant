import 'expo-dev-client'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import {
  API_BASE,
  APP_WEB_BASE,
  apiFetch,
  buildSessionRecord,
  clearJobDraft,
  getPublicAppUrl,
  loadJobDraft,
  loadStoredSession,
  persistJobDraft,
  persistSession,
  SUPPORT_EMAIL
} from './src/api'
import GoogleMapsLink from './src/GoogleMapsLink'
import { colors, commonStyles } from './src/theme'

const NAV_ITEMS = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'clients', label: 'Clients' }
]

const JOB_STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']
const FREE_JOB_TYPE_LIMIT = 4
const JOB_TYPE_COLOR_PRESETS = ['#22c55e', '#f97316', '#3b82f6', '#06b6d4', '#8b5cf6', '#f43f5e', '#eab308', '#14b8a6']
const CALENDAR_VIEWS = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' }
]
const PHONE_EXAMPLE = '(555) 123-4567'
const KEYBOARD_SCROLL_DELAY_MS = Platform.OS === 'ios' ? 80 : 140
const AUTH_KEYBOARD_EXTRA_OFFSET = 96
const WORKSPACE_KEYBOARD_EXTRA_OFFSET = 120
const DEFAULT_JOB_DURATION_MINUTES = 60
const DAY_TIMELINE_DEFAULT_START_HOUR = 8
const DAY_TIMELINE_DEFAULT_END_HOUR = 18
const DAY_TIMELINE_MIN_VISIBLE_HOURS = 8
const DAY_TIMELINE_ROW_HEIGHT = 76
const DAY_TIMELINE_MIN_CARD_HEIGHT = 56
const SELF_SERVE_PLAN_CODES = ['free', 'starter', 'team', 'pro']
const DEFAULT_BILLING_PLANS = [
  {
    code: 'free',
    name: 'Free',
    priceLabel: '$0',
    userLimit: 1,
    monthlyClientLimit: 10,
    monthlyJobLimit: 25,
    description: 'Try the full scheduling flow with monthly creation limits.',
    features: [
      '1 user',
      '10 new clients per month',
      '25 new jobs per month',
      `Up to ${FREE_JOB_TYPE_LIMIT} custom job types`,
      'Calendar, clients, notes, and payment tracking'
    ],
    canSelfServe: true
  },
  {
    code: 'starter',
    name: 'Starter',
    priceLabel: '$14.99/mo',
    userLimit: 1,
    monthlyClientLimit: null,
    monthlyJobLimit: null,
    description: 'Unlimited records for solo operators.',
    features: [
      '1 user',
      'Unlimited clients and jobs',
      'Unlimited custom job types and calendar colors',
      'Core scheduling workflow'
    ],
    canSelfServe: true
  },
  {
    code: 'team',
    name: 'Team',
    priceLabel: '$39.99/mo',
    userLimit: 5,
    monthlyClientLimit: null,
    monthlyJobLimit: null,
    description: 'Shared scheduling for small crews.',
    features: [
      'Up to 5 users',
      'Unlimited clients and jobs',
      'Shared scheduling foundations',
      'Built for growing teams'
    ],
    canSelfServe: true
  },
  {
    code: 'pro',
    name: 'Pro',
    priceLabel: '$79.99/mo',
    userLimit: 15,
    monthlyClientLimit: null,
    monthlyJobLimit: null,
    description: 'Advanced tools for scaling service businesses.',
    features: [
      'Up to 15 users',
      'Unlimited clients and jobs',
      'Best fit for automation and advanced workflows',
      'Mobile and desktop access'
    ],
    canSelfServe: true
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'From $249/mo',
    userLimit: null,
    monthlyClientLimit: null,
    monthlyJobLimit: null,
    description: 'Custom onboarding, integrations, and support.',
    features: [
      'Custom user limits',
      'Priority onboarding',
      'Custom integrations',
      'Contact sales'
    ],
    canSelfServe: false
  }
]

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

const PUBLIC_PATHS = {
  privacy: '/privacy',
  support: '/support',
  account: '/account'
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

const formatSchedulePreview = (jobDate, startTime) => {
  const date = parseDateValue(jobDate)
  const dateLabel = date
    ? date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    : 'Date not set'

  if (!startTime) return `${dateLabel} | Time not set`

  return `${dateLabel} | ${formatTimeRange(startTime)}`
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

const JOB_TYPE_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/

const normalizeJobTypeName = (value) => String(value || '').trim()

const normalizeJobTypeKey = (value) => normalizeJobTypeName(value).toLowerCase()

const normalizeJobTypeColor = (value) => {
  const trimmed = String(value || '').trim()
  return JOB_TYPE_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : ''
}

const hexToRgb = (value) => {
  const hex = normalizeJobTypeColor(value)
  if (!hex) return null

  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  }
}

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`

const clampColor = (value, min, max) => Math.min(Math.max(value, min), max)

const mixColor = (first, second, ratio) => {
  const source = hexToRgb(first)
  const target = hexToRgb(second)
  if (!source || !target) return first

  return rgbToHex({
    r: Math.round(source.r + ((target.r - source.r) * ratio)),
    g: Math.round(source.g + ((target.g - source.g) * ratio)),
    b: Math.round(source.b + ((target.b - source.b) * ratio))
  })
}

const formatBillingResetDate = (value) => {
  const date = parseDateValue(value)
  if (!date) return 'Unavailable'

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const getUsageLimitPromptDetails = (summary) => {
  if (!summary || summary.planCode !== 'free' || !summary.entitlements?.creationBlocked) {
    return null
  }

  const usage = summary.usage || {}
  const clientsBlocked =
    usage.monthlyClientLimit !== null &&
    usage.monthlyClientLimit !== undefined &&
    Number(usage.monthlyClientCreations ?? 0) >= Number(usage.monthlyClientLimit)
  const jobsBlocked =
    usage.monthlyJobLimit !== null &&
    usage.monthlyJobLimit !== undefined &&
    Number(usage.monthlyJobCreations ?? 0) >= Number(usage.monthlyJobLimit)

  const exhaustedLimits = []
  if (clientsBlocked) exhaustedLimits.push(`${usage.monthlyClientLimit} clients`)
  if (jobsBlocked) exhaustedLimits.push(`${usage.monthlyJobLimit} jobs`)

  const limitLabel =
    exhaustedLimits.length === 0
      ? 'the included Free plan usage'
      : exhaustedLimits.length === 1
        ? exhaustedLimits[0]
        : `${exhaustedLimits.slice(0, -1).join(', ')} and ${exhaustedLimits[exhaustedLimits.length - 1]}`

  return {
    signature: `${summary.currentPeriodEndsAt}:${clientsBlocked ? 'clients' : 'no-clients'}:${jobsBlocked ? 'jobs' : 'no-jobs'}`,
    title: 'Free Plan Limit Reached',
    message: `You have used all ${limitLabel} included with the Free plan. Your allowance resets on ${formatBillingResetDate(summary.currentPeriodEndsAt)}.`
  }
}

const getContrastTextColor = (backgroundColor) => {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) return '#f8fafc'

  const luminance = (0.2126 * rgb.r) + (0.7152 * rgb.g) + (0.0722 * rgb.b)
  return luminance > 150 ? '#0f172a' : '#f8fafc'
}

const buildFallbackJobTypeColor = (value) => {
  const normalized = normalizeJobTypeKey(value)
  let hash = 0

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0
  }

  const red = 96 + (hash & 0x3f)
  const green = 96 + ((hash >> 6) & 0x3f)
  const blue = 96 + ((hash >> 12) & 0x3f)

  return rgbToHex({
    r: clampColor(red, 0, 255),
    g: clampColor(green, 0, 255),
    b: clampColor(blue, 0, 255)
  })
}

const buildJobTypePalette = (color, fallbackSeed) => {
  const background = normalizeJobTypeColor(color) || buildFallbackJobTypeColor(fallbackSeed)
  return {
    background,
    border: mixColor(background, '#000000', 0.18),
    text: getContrastTextColor(background)
  }
}

const getJobTypeRecord = (value, jobTypes = []) => {
  const normalizedValue = normalizeJobTypeName(value)
  const normalizedKey = normalizeJobTypeKey(value)

  return jobTypes.find((jobType) => {
    if (jobType.id !== undefined && String(jobType.id) === normalizedValue) {
      return true
    }

    return (
      normalizeJobTypeKey(jobType.name) === normalizedKey ||
      normalizeJobTypeKey(jobType.normalized_name) === normalizedKey
    )
  }) || null
}

const getJobTypeColors = (jobType, jobTypes = []) => {
  const record = getJobTypeRecord(jobType, jobTypes)
  if (normalizeJobTypeColor(jobType) && !record) {
    return buildJobTypePalette(jobType, jobType)
  }

  return buildJobTypePalette(record?.color, record?.name || jobType)
}

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

const searchClients = (clients, query) => {
  const value = String(query || '').trim().toLowerCase()
  if (!value) return clients

  return clients.filter((client) =>
    [client.name, client.phone, client.address].some((fieldValue) =>
      String(fieldValue || '').toLowerCase().includes(value)
    )
  )
}

const applyClientDetails = (client) => ({
  name: client.name || '',
  phone: normalizePhoneDigits(client.phone || ''),
  address: client.address || ''
})

const getApiErrorMessage = (payload, fallback) =>
  payload?.error || payload?.message || payload?.errors?.[0]?.msg || fallback


function AppContent() {
  const authScrollRef = useRef(null)
  const workspaceScrollRef = useRef(null)
  const focusedInputRef = useRef({ area: null, target: null })
  const keyboardScrollTimeoutRef = useRef(null)
  const usageLimitPromptSignatureRef = useRef('')
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
  const [authScreenMode, setAuthScreenMode] = useState(null)
  const [authForm, setAuthForm] = useState({ displayName: '', email: '', password: '', confirmPassword: '' })
  const [authErrors, setAuthErrors] = useState({})
  const [authStatus, setAuthStatus] = useState(null)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [jobForm, setJobForm] = useState(EMPTY_JOB_FORM)
  const [jobErrors, setJobErrors] = useState({})
  const [jobStatus, setJobStatus] = useState(null)
  const [jobSuggestionField, setJobSuggestionField] = useState(null)
  const [jobTypes, setJobTypes] = useState([])
  const [jobTypesLoading, setJobTypesLoading] = useState(false)
  const [jobTypesError, setJobTypesError] = useState('')
  const [billingSummary, setBillingSummary] = useState(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState('')
  const [billingStatus, setBillingStatus] = useState('')
  const [billingSavingPlanCode, setBillingSavingPlanCode] = useState('')
  const [accountDeletionForm, setAccountDeletionForm] = useState({ password: '', confirmText: '' })
  const [accountDeletionStatus, setAccountDeletionStatus] = useState('')
  const [accountDeletionSubmitting, setAccountDeletionSubmitting] = useState(false)
  const [jobTypeDraft, setJobTypeDraft] = useState({ name: '', color: JOB_TYPE_COLOR_PRESETS[0] })
  const [jobTypeEditingId, setJobTypeEditingId] = useState(null)
  const [jobTypeFormError, setJobTypeFormError] = useState('')
  const [jobTypeSaving, setJobTypeSaving] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [existingClientPickerVisible, setExistingClientPickerVisible] = useState(false)
  const [existingClientPickerQuery, setExistingClientPickerQuery] = useState('')
  const [calendarView, setCalendarView] = useState('day')
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => startOfDay(new Date()))
  const [calendarJobTypesVisible, setCalendarJobTypesVisible] = useState(false)

  const scrollFocusedInputIntoView = useCallback((area, target) => {
    if (!target) return

    const scrollRef = area === 'auth' ? authScrollRef.current : workspaceScrollRef.current
    if (!scrollRef) return

    const responder = typeof scrollRef.getScrollResponder === 'function' ? scrollRef.getScrollResponder() : scrollRef
    if (typeof responder?.scrollResponderScrollNativeHandleToKeyboard !== 'function') return

    requestAnimationFrame(() => {
      responder.scrollResponderScrollNativeHandleToKeyboard(
        target,
        area === 'auth' ? AUTH_KEYBOARD_EXTRA_OFFSET : WORKSPACE_KEYBOARD_EXTRA_OFFSET,
        true
      )
    })
  }, [])

  const scheduleScrollToFocusedInput = useCallback((area, target) => {
    if (!target) return

    if (keyboardScrollTimeoutRef.current) {
      clearTimeout(keyboardScrollTimeoutRef.current)
    }

    keyboardScrollTimeoutRef.current = setTimeout(() => {
      scrollFocusedInputIntoView(area, target)
      keyboardScrollTimeoutRef.current = null
    }, KEYBOARD_SCROLL_DELAY_MS)
  }, [scrollFocusedInputIntoView])

  const registerFocusedInput = useCallback((area, event) => {
    const target = event?.target ?? event?.nativeEvent?.target
    focusedInputRef.current = { area, target }
    scheduleScrollToFocusedInput(area, target)
  }, [scheduleScrollToFocusedInput])

  const handleAuthInputFocus = useCallback((event) => {
    registerFocusedInput('auth', event)
  }, [registerFocusedInput])

  const handleWorkspaceInputFocus = useCallback((event) => {
    registerFocusedInput('workspace', event)
  }, [registerFocusedInput])

  const openBillingLimitPrompt = useCallback((summary) => {
    const prompt = getUsageLimitPromptDetails(summary)
    if (!prompt) return

    if (usageLimitPromptSignatureRef.current === prompt.signature) return
    usageLimitPromptSignatureRef.current = prompt.signature

    Alert.alert(
      prompt.title,
      `${prompt.message} Open billing to upgrade and keep creating records.`,
      [
        {
          text: 'Open billing',
          onPress: () => setActiveTab('billing')
        }
      ],
      { cancelable: false }
    )
  }, [])

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
    const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const keyboardShowSubscription = Keyboard.addListener(keyboardShowEvent, () => {
      const { area, target } = focusedInputRef.current
      if (area && target) {
        scheduleScrollToFocusedInput(area, target)
      }
    })

    return () => {
      keyboardShowSubscription.remove()
      if (keyboardScrollTimeoutRef.current) {
        clearTimeout(keyboardScrollTimeoutRef.current)
      }
    }
  }, [scheduleScrollToFocusedInput])

  useEffect(() => {
    if (!session) {
      usageLimitPromptSignatureRef.current = ''
    }
  }, [session])

  useEffect(() => {
    const prompt = getUsageLimitPromptDetails(billingSummary)
    if (!prompt) return

    if (activeTab === 'billing') {
      usageLimitPromptSignatureRef.current = prompt.signature
      return
    }

    openBillingLimitPrompt(billingSummary)
  }, [activeTab, billingSummary, openBillingLimitPrompt])

  useEffect(() => {
    if (!session) {
      setAccountDeletionForm({ password: '', confirmText: '' })
      setAccountDeletionStatus('')
      setAccountDeletionSubmitting(false)
    }
  }, [session])

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

  useEffect(() => {
    if (!session) {
      setJobTypes([])
      setJobTypesError('')
      setJobTypesLoading(false)
      return
    }

    let active = true
    const loadJobTypes = async () => {
      setJobTypesLoading(true)
      setJobTypesError('')

      try {
        const response = await apiFetch('/job-types', {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          onSessionChange: setSession
        })
        if (!response.ok) throw new Error('Unable to load job types')
        const payload = await response.json()
        if (active) setJobTypes(Array.isArray(payload) ? payload : [])
      } catch (error) {
        if (active) {
          setJobTypes([])
          setJobTypesError(error.message || 'Unable to load job types')
        }
      } finally {
        if (active) setJobTypesLoading(false)
      }
    }

    loadJobTypes()
    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (!session) {
      setBillingSummary(null)
      setBillingError('')
      setBillingLoading(false)
      setBillingStatus('')
      return
    }

    let active = true
    const loadBilling = async () => {
      setBillingLoading(true)
      setBillingError('')

      try {
        const response = await apiFetch('/billing/summary', {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          onSessionChange: setSession
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Unable to load billing details')
        if (active) setBillingSummary(payload)
      } catch (error) {
        if (active) {
          setBillingSummary(null)
          setBillingError(error.message || 'Unable to load billing details')
        }
      } finally {
        if (active) setBillingLoading(false)
      }
    }

    loadBilling()
    return () => {
      active = false
    }
  }, [session])

  const clients = useMemo(() => buildClients(jobs), [jobs])
  const jobsGroupedByDate = useMemo(() => {
    const groups = new Map()

    jobs.forEach((job) => {
      const dateKey = formatDateValue(job.job_date) || 'unscheduled'
      if (!groups.has(dateKey)) {
        groups.set(dateKey, [])
      }
      groups.get(dateKey).push(job)
    })

    return Array.from(groups.entries())
      .sort(([firstDate], [secondDate]) => {
        if (firstDate === 'unscheduled') return 1
        if (secondDate === 'unscheduled') return -1
        return getDateTimestamp(firstDate) - getDateTimestamp(secondDate)
      })
      .map(([dateKey, groupedJobs]) => ({
        dateKey,
        title: dateKey === 'unscheduled' ? 'No date assigned' : formatFullDate(dateKey),
        jobs: groupedJobs
      }))
  }, [jobs])
  const jobTypeOptions = useMemo(() => {
    return [...jobTypes].sort((first, second) => {
      const firstOrder = Number(first.sort_order ?? 0)
      const secondOrder = Number(second.sort_order ?? 0)
      if (firstOrder !== secondOrder) return firstOrder - secondOrder
      return normalizeJobTypeName(first.name).localeCompare(normalizeJobTypeName(second.name))
    })
  }, [jobTypes])
  const canManageJobTypes = billingSummary?.entitlements?.canManageJobTypes ?? true
  const jobTypeLimit = billingSummary?.entitlements?.jobTypeLimit
  const jobTypeLimitReached = jobTypeLimit !== null && jobTypeLimit !== undefined && jobTypes.length >= Number(jobTypeLimit)
  const jobTypeLimitMessage =
    jobTypeLimit === undefined
      ? ''
      : jobTypeLimit === null
        ? 'Starter and above include unlimited custom job types.'
        : `${jobTypes.length}/${jobTypeLimit} Free custom job types used. Starter and above include unlimited job types.`
  const jobTypeInputHelper =
    jobTypeLimitReached
      ? `Free job type limit reached. Select an existing job type or upgrade for unlimited job types.`
      : jobTypes.length === 0
      ? 'Enter your first job type. Free includes up to 4 custom job types.'
      : 'Type a new job type or choose an existing one below.'
  const creationBlocked = billingSummary?.entitlements?.creationBlocked ?? false
  const billingPlans = billingSummary?.plans?.length ? billingSummary.plans : DEFAULT_BILLING_PLANS

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase()
    if (!query) return clients
    return clients.filter((client) =>
      [client.name, client.phone, client.address].some((value) =>
        (value || '').toLowerCase().includes(query)
      )
    )
  }, [clients, clientSearch])
  const existingClientPickerClients = useMemo(
    () => searchClients(clients, existingClientPickerQuery),
    [clients, existingClientPickerQuery]
  )

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

  const refreshJobTypes = async () => {
    if (!session) return
    const response = await apiFetch('/job-types', {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      onSessionChange: setSession
    })
    if (response.ok) {
      setJobTypes(await response.json())
    }
  }

  const refreshBilling = async () => {
    if (!session) return null
    const response = await apiFetch('/billing/summary', {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      onSessionChange: setSession
    })
    const payload = await response.json().catch(() => ({}))
    if (response.ok) {
      setBillingSummary(payload)
      setBillingError('')
      return payload
    }
    setBillingError(payload.error || 'Unable to load billing details')
    return null
  }

  const selectPlan = async (planCode) => {
    if (!session) throw new Error('Please sign in to manage billing')

    setBillingSavingPlanCode(planCode)
    setBillingStatus('')
    try {
      const response = await apiFetch('/billing/subscription', {
        method: 'PUT',
        body: JSON.stringify({ planCode }),
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        onSessionChange: setSession
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to update plan')
      }
      if (payload.checkoutUrl) {
        setBillingStatus('Opening Stripe Checkout...')
        await Linking.openURL(payload.checkoutUrl)
        return payload
      }
      if (payload.portalUrl) {
        setBillingStatus('Opening Stripe customer portal...')
        await Linking.openURL(payload.portalUrl)
        return payload
      }
      if (payload.subscription) {
        setBillingSummary(payload.subscription)
      }
      setBillingStatus(payload.message || 'Plan updated')
      return payload.subscription || null
    } catch (error) {
      setBillingStatus(error.message || 'Unable to update plan')
      return null
    } finally {
      setBillingSavingPlanCode('')
    }
  }

  const openBillingPortal = async () => {
    if (!session) throw new Error('Please sign in to manage billing')

    setBillingSavingPlanCode('portal')
    setBillingStatus('')
    try {
      const response = await apiFetch('/billing/portal-session', {
        method: 'POST',
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        onSessionChange: setSession
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to open billing portal')
      }
      if (payload.subscription) {
        setBillingSummary(payload.subscription)
      }
      if (payload.portalUrl) {
        setBillingStatus('Opening Stripe customer portal...')
        await Linking.openURL(payload.portalUrl)
        return payload
      }
      setBillingStatus(payload.message || 'Billing portal ready')
      return payload
    } catch (error) {
      setBillingStatus(error.message || 'Unable to open billing portal')
      return null
    } finally {
      setBillingSavingPlanCode('')
    }
  }

  const createJobType = async ({ name, color }) => {
    if (!session) throw new Error('Please sign in to manage job types')

    const response = await apiFetch('/job-types', {
      method: 'POST',
      body: JSON.stringify({
        name,
        color
      }),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      onSessionChange: setSession
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (payload.subscription) setBillingSummary(payload.subscription)
      throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to create job type')
    }

    await refreshJobTypes()
    return payload
  }

  const updateJobType = async (jobTypeId, { name, color }) => {
    if (!session) throw new Error('Please sign in to manage job types')

    const response = await apiFetch(`/job-types/${jobTypeId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        color
      }),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      onSessionChange: setSession
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (payload.subscription) setBillingSummary(payload.subscription)
      throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to update job type')
    }

    await refreshJobTypes()
    return payload
  }

  const deleteJobType = async (jobTypeId) => {
    if (!session) throw new Error('Please sign in to manage job types')

    const response = await apiFetch(`/job-types/${jobTypeId}`, {
      method: 'DELETE',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      onSessionChange: setSession
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (payload.subscription) setBillingSummary(payload.subscription)
      throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to delete job type')
    }

    await refreshJobTypes()
    return payload
  }

  const startEditingJobType = (jobType) => {
    setJobTypeEditingId(jobType.id)
    setJobTypeDraft({
      name: jobType.name || '',
      color: normalizeJobTypeColor(jobType.color) || JOB_TYPE_COLOR_PRESETS[0]
    })
    setJobTypeFormError('')
  }

  const resetJobTypeDraft = () => {
    setJobTypeEditingId(null)
    setJobTypeDraft({ name: '', color: JOB_TYPE_COLOR_PRESETS[0] })
    setJobTypeFormError('')
  }

  const submitJobTypeDraft = async () => {
    if (!canManageJobTypes) {
      setJobTypeFormError('Job type management is unavailable for this workspace.')
      return
    }

    if (!jobTypeEditingId && jobTypeLimitReached) {
      setJobTypeFormError(`Free accounts can keep up to ${jobTypeLimit} custom job types. Edit or delete an unused type, or upgrade to Starter for unlimited job types.`)
      return
    }

    const name = normalizeJobTypeName(jobTypeDraft.name)
    if (!name) {
      setJobTypeFormError('Enter a job type name')
      return
    }

    setJobTypeSaving(true)
    setJobTypeFormError('')

    try {
      if (jobTypeEditingId) {
        await updateJobType(jobTypeEditingId, { name, color: jobTypeDraft.color })
      } else {
        await createJobType({ name, color: jobTypeDraft.color })
      }
      resetJobTypeDraft()
    } catch (error) {
      setJobTypeFormError(error.message || 'Unable to save job type')
    } finally {
      setJobTypeSaving(false)
    }
  }

  const removeJobType = async (jobType) => {
    if (!canManageJobTypes) {
      setJobTypeFormError('Job type management is unavailable for this workspace.')
      return
    }

    Alert.alert(
      'Delete job type?',
      `Delete the ${jobType.name} job type?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setJobTypeSaving(true)
              await deleteJobType(jobType.id)
              if (jobTypeEditingId === jobType.id) {
                resetJobTypeDraft()
              }
            } catch (error) {
              setJobTypeFormError(error.message || 'Unable to delete job type')
            } finally {
              setJobTypeSaving(false)
            }
          }
        }
      ]
    )
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
      case 'jobType': {
        const trimmed = value.trim()
        if (!trimmed) return 'Job type is required.'
        const matchesExistingJobType = jobTypeOptions.some((jobType) => normalizeJobTypeKey(jobType.name) === normalizeJobTypeKey(trimmed))
        if (jobTypeLimitReached && !matchesExistingJobType) {
          return `Free accounts can keep up to ${jobTypeLimit} custom job types. Choose an existing type or upgrade for unlimited job types.`
        }
        return ''
      }
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
      case 'email':
        if (!trimmed) {
          return mode === 'create'
            ? 'Enter an email address for the new account.'
            : 'Enter the email address for your account.'
        }
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? '' : 'Enter a valid email address.'
      case 'displayName':
        if (mode !== 'create') return ''
        if (!trimmed) return 'Choose a display name before creating your account.'
        if (trimmed.length < 3) {
          return 'Display name must be at least 3 characters long.'
        }
        return ''
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
      return 'That email or password did not match our records.'
    }
    if (normalized.includes('duplicate') || normalized.includes('already') || normalized.includes('taken')) {
      return mode === 'create'
        ? 'That email address is already in use. Try signing in instead.'
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

  const openAuthScreen = (mode) => {
    setAuthMode(mode)
    setAuthScreenMode(mode)
    setAuthErrors({})
    setAuthStatus(null)
  }

  const closeAuthScreen = () => {
    if (authSubmitting) return
    setAuthScreenMode(null)
    setAuthErrors({})
    setAuthStatus(null)
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
            displayName: authForm.displayName,
            email: authForm.email,
            password: authForm.password
          })
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to create account')
        setAuthMode('login')
        setAuthScreenMode('login')
        setAuthForm((current) => ({ ...current, password: '', confirmPassword: '' }))
        setAuthErrors({})
        setAuthStatus({ type: 'success', message: payload.message || 'Account created. Log in to continue.' })
      } else {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authForm.email,
            usernameOrEmail: authForm.email,
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

    if (creationBlocked) {
      setJobStatus({
        type: 'error',
        message: `This workspace has reached its monthly free-tier limit. Upgrade or wait for the reset on ${formatBillingResetDate(billingSummary?.currentPeriodEndsAt)}.`
      })
      openBillingLimitPrompt(billingSummary)
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
      if (!response.ok) {
        if (payload.subscription) setBillingSummary(payload.subscription)
        throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to create job')
      }
      if (payload.subscription) setBillingSummary(payload.subscription)
      setJobForm(EMPTY_JOB_FORM)
      setJobSuggestionField(null)
      setJobStatus({ type: 'success', message: 'Job created successfully' })
      await clearJobDraft()
      setActiveTab('calendar')
      await refreshJobs()
      await refreshJobTypes()
      await refreshBilling()
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

  const openPublicPage = async (path) => {
    const url = getPublicAppUrl(path)
    try {
      await Linking.openURL(url)
    } catch {
      Alert.alert('Unable to open link', `Try opening ${url} in your browser.`)
    }
  }

  const openSupportContact = async () => {
    if (!SUPPORT_EMAIL) {
      await openPublicPage(PUBLIC_PATHS.support)
      return
    }

    const supportUrl = `mailto:${SUPPORT_EMAIL}`
    try {
      await Linking.openURL(supportUrl)
    } catch {
      await openPublicPage(PUBLIC_PATHS.support)
    }
  }

  const submitAccountDeletion = async () => {
    if (!session) return

    setAccountDeletionSubmitting(true)
    setAccountDeletionStatus('')
    try {
      const response = await apiFetch('/users/me', {
        method: 'DELETE',
        body: JSON.stringify(accountDeletionForm),
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        onSessionChange: setSession
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (payload?.portalUrl) {
          setAccountDeletionStatus(payload.error || 'Open Stripe to cancel your subscription before deleting the account.')
          await Linking.openURL(payload.portalUrl)
          return
        }

        throw new Error(getApiErrorMessage(payload, 'Unable to delete your account right now.'))
      }

      setAccountDeletionForm({ password: '', confirmText: '' })
      setAccountDeletionStatus(payload.message || 'Your account and workspace data were deleted.')
      setActiveTab('calendar')
      Alert.alert('Account deleted', payload.message || 'Your account and workspace data were deleted.')
      setSession(null)
    } catch (error) {
      setAccountDeletionStatus(error.message || 'Unable to delete your account right now.')
    } finally {
      setAccountDeletionSubmitting(false)
    }
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
    await refreshJobTypes()
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
    const palette = getJobTypeColors(job.job_type_color || job.job_type, jobTypes)

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
    const palette = getJobTypeColors(job.job_type_color || job.job_type, jobTypes)
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

  const renderCalendarLegend = () => (
    <View style={styles.calendarLegend}>
      {jobTypeOptions.map((jobType) => (
        <View key={jobType.id || jobType.name} style={styles.calendarLegendItem}>
          <View style={[styles.calendarLegendSwatch, { backgroundColor: getJobTypeColors(jobType.color || jobType.name, jobTypes).background }]} />
          <Text style={styles.calendarLegendText}>{jobType.name}</Text>
        </View>
      ))}
    </View>
  )

  const renderCalendarContent = () => {
    if (calendarView === 'day') {
      const dayJobs = jobsByDate.get(toDateKey(calendarAnchorDate)) || []
      const { scheduledJobs, unscheduledJobs, timelineStartMinutes, visibleHourCount, timeSlots } = buildDayTimeline(dayJobs)
      const timelineHeight = visibleHourCount * DAY_TIMELINE_ROW_HEIGHT
      const totalGrossIncomeToday = dayJobs.reduce((sum, job) => sum + (Number(job.payment) || 0), 0)

      return (
        <>
          <View style={commonStyles.panel}>
            <View style={styles.calendarDayHeader}>
              <Text style={commonStyles.heading3}>Appointments for the day</Text>
              <Pressable
                style={[styles.calendarInlineToggle, calendarJobTypesVisible ? styles.calendarInlineToggleActive : null]}
                onPress={() => setCalendarJobTypesVisible((current) => !current)}
              >
                <Text style={styles.calendarInlineToggleText}>
                  {calendarJobTypesVisible ? 'Hide Job Types' : 'Job Types'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.calendarDaySummaryRow}>
              <Text style={commonStyles.text}>{dayJobs.length} scheduled job{dayJobs.length === 1 ? '' : 's'}</Text>
              <Text style={styles.calendarGrossIncomeText}>Gross today: {formatCurrency(totalGrossIncomeToday)}</Text>
            </View>
            <View style={styles.calendarDayActionRow}>
              <Chip label="Previous" onPress={() => stepCalendar(-1)} />
              <Chip label="Today" active onPress={jumpCalendarToToday} />
              <Chip label="Next" onPress={() => stepCalendar(1)} />
            </View>
            {calendarJobTypesVisible ? <View style={styles.calendarDayLegendWrap}>{renderCalendarLegend()}</View> : null}
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
        const dayGross = dayJobs.reduce((sum, job) => sum + (Number(job.payment) || 0), 0)

        return (
          <View key={dateKey} style={[commonStyles.panel, dateKey === calendarTodayKey ? styles.calendarPanelToday : null]}>
            <View style={styles.calendarSectionHeader}>
              <Text style={commonStyles.heading3}>{date.toLocaleDateString('en-US', { weekday: 'long' })}</Text>
              <View style={commonStyles.chip}>
                <Text style={commonStyles.chipText}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              </View>
            </View>
            {dayJobs.length > 0 ? <Text style={styles.calendarGrossSubtext}>Gross {formatCurrency(dayGross)}</Text> : null}
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
            const dayGross = dayJobs.reduce((sum, job) => sum + (Number(job.payment) || 0), 0)
            const palette = dayJobs[0] ? getJobTypeColors(dayJobs[0].job_type_color || dayJobs[0].job_type, jobTypes) : null

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
                    <Text style={styles.monthCellGross}>{formatCurrency(dayGross)}</Text>
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
      const monthGross = monthJobs.reduce((sum, job) => sum + (Number(job.payment) || 0), 0)

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
          {monthJobs.length > 0 ? <Text style={styles.calendarGrossSubtext}>Gross {formatCurrency(monthGross)}</Text> : null}
          <View style={styles.yearLegendRow}>
            {jobTypeOptions.map((jobType) => {
              const count = monthJobs.filter((job) => normalizeJobTypeKey(job.job_type) === normalizeJobTypeKey(jobType.name)).length
              if (count === 0) return null

              return (
                <View key={jobType.id || jobType.name} style={styles.yearLegendItem}>
                  <View style={[styles.yearLegendDot, { backgroundColor: getJobTypeColors(jobType.color || jobType.name, jobTypes).background }]} />
                  <Text style={commonStyles.text}>{jobType.name}: {count}</Text>
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

  const jobCreationSchedule = formatSchedulePreview(jobForm.jobDate, jobForm.startTime)
  const currentPageTitle =
    activeTab === 'jobs-new'
      ? 'Create a new job'
      : activeTab === 'jobs'
        ? 'Job dashboard'
        : activeTab === 'clients'
          ? 'Client relationships'
        : activeTab === 'billing'
          ? 'Billing and plans'
          : 'Calendar overview'
  const navStickyIndex = billingSummary?.entitlements?.creationBlocked ? 2 : 1

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
    const authScreenActive = Boolean(authScreenMode)
    const authHealthMessage = apiHealth.status === 'success' ? 'Backend connected and ready.' : apiHealth.message
    return (
      <SafeAreaView style={[commonStyles.screen, styles.authScreen]}>
        <ExpoStatusBar style="light" />
        <KeyboardAvoidingView style={styles.keyboardFrame} behavior={keyboardAvoidingBehavior}>
          <ScrollView
            ref={authScrollRef}
            contentContainerStyle={[
              styles.authScrollContent,
              authScreenActive ? styles.authScrollContentForm : null
            ]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={[styles.authBackdrop, authScreenActive ? styles.authBackdropForm : null]}>
              <View style={styles.authGlowTop} />
              <View style={styles.authGlowBottom} />
              <View style={styles.authGrid} />
              <View style={[styles.authHero, authScreenActive ? styles.authHeroCompact : null]}>
                <Text style={[styles.authEyebrow, authScreenActive ? styles.authEyebrowCompact : null]}>
                  Mobile scheduling for service teams
                </Text>
                <View style={[styles.authMonogram, authScreenActive ? styles.authMonogramCompact : null]}>
                  <Text style={[styles.authMonogramText, authScreenActive ? styles.authMonogramTextCompact : null]}>
                    AA
                  </Text>
                </View>
                <Text style={[styles.authWordmarkPrimary, authScreenActive ? styles.authWordmarkCompact : null]}>
                  APPOINTMENT
                </Text>
                <Text style={[styles.authWordmarkAccent, authScreenActive ? styles.authWordmarkAccentCompact : null]}>
                  ASSISTANT
                </Text>
                <Text style={[styles.authHeroTitle, authScreenActive ? styles.authHeroTitleCompact : null]}>
                  Manage bookings, clients, and calendar updates from one workspace.
                </Text>
                <Text
                  style={[
                    apiHealth.status === 'error' ? styles.authHeroStatusError : styles.authHeroStatus,
                    authScreenActive ? styles.authHeroStatusCompact : null
                  ]}
                >
                  {authHealthMessage}
                </Text>
              </View>
              <View style={[styles.authSheet, authScreenActive ? styles.authSheetForm : null]}>
                {authScreenActive ? (
                  <View style={styles.authFormWrap}>
                    <View style={styles.authFormHeader}>
                      <View style={styles.authFormCopy}>
                        <Text style={styles.authFormEyebrow}>{isCreate ? 'Create your workspace' : 'Welcome back'}</Text>
                        <Text style={styles.authFormTitle}>{isCreate ? 'Sign Up Free' : 'Log In'}</Text>
                        <Text style={styles.authFormText}>
                          {isCreate
                            ? 'Start with your email and create an account when you are ready.'
                            : 'Enter your account details to get back into your schedule.'}
                        </Text>
                      </View>
                      <Pressable onPress={closeAuthScreen}>
                        <Text style={styles.authBackLink}>Back</Text>
                      </Pressable>
                    </View>
                    {isCreate ? <FormField label="Display name" labelStyle={styles.authInputLabel} inputStyle={styles.authInput} value={authForm.displayName} onFocus={handleAuthInputFocus} onChangeText={(value) => {
                      setAuthForm((current) => ({ ...current, displayName: value }))
                      setAuthErrors((current) => ({ ...current, displayName: '' }))
                      setAuthStatus(null)
                    }} error={authErrors.displayName} /> : null}
                    <FormField label="Email" labelStyle={styles.authInputLabel} inputStyle={styles.authInput} value={authForm.email} onFocus={handleAuthInputFocus} onChangeText={(value) => {
                      setAuthForm((current) => ({ ...current, email: value }))
                      setAuthErrors((current) => ({ ...current, email: '' }))
                      setAuthStatus(null)
                    }} error={authErrors.email} />
                    <FormField label="Password" labelStyle={styles.authInputLabel} inputStyle={styles.authInput} value={authForm.password} onFocus={handleAuthInputFocus} onChangeText={(value) => {
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
                    {isCreate ? <FormField label="Confirm password" labelStyle={styles.authInputLabel} inputStyle={styles.authInput} value={authForm.confirmPassword} onFocus={handleAuthInputFocus} onChangeText={(value) => {
                      setAuthForm((current) => ({ ...current, confirmPassword: value }))
                      setAuthErrors((current) => ({ ...current, confirmPassword: '' }))
                      setAuthStatus(null)
                    }} error={authErrors.confirmPassword} secureTextEntry /> : null}
                    <Pressable style={[commonStyles.button, styles.authPrimaryButton]} onPress={submitAuth}>
                      <View style={styles.authPrimaryButtonGlow} />
                      <View style={styles.authPrimaryButtonGlowSecondary} />
                      <Text style={styles.authPrimaryButtonText}>{authSubmitting ? 'Working...' : isCreate ? 'Sign Up Free' : 'Log In'}</Text>
                    </Pressable>
                    {authStatus ? <Text style={authStatus.type === 'error' ? commonStyles.errorText : commonStyles.successText}>{authStatus.message}</Text> : null}
                    <Pressable onPress={() => openAuthScreen(isCreate ? 'login' : 'create')}>
                      <Text style={styles.authModeSwitch}>
                        {isCreate ? 'Already have an account? Log In' : 'Need an account? Sign Up Free'}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.authCtaStack}>
                    <Pressable style={[commonStyles.button, styles.authPrimaryButton]} onPress={() => openAuthScreen('create')}>
                      <View style={styles.authPrimaryButtonGlow} />
                      <View style={styles.authPrimaryButtonGlowSecondary} />
                      <Text style={styles.authPrimaryButtonText}>Sign Up Free</Text>
                    </Pressable>
                    <Pressable style={[commonStyles.button, styles.authSecondaryButton]} onPress={() => openAuthScreen('login')}>
                      <Text style={styles.authSecondaryButtonText}>Log In</Text>
                    </Pressable>
                  </View>
                )}
                <View style={styles.inlineLinkRow}>
                  <Pressable onPress={() => openPublicPage(PUBLIC_PATHS.privacy)}>
                    <Text style={styles.authInlineLinkText}>Privacy policy</Text>
                  </Pressable>
                  <Pressable onPress={() => openPublicPage(PUBLIC_PATHS.support)}>
                    <Text style={styles.authInlineLinkText}>Support</Text>
                  </Pressable>
                  <Pressable onPress={() => openPublicPage(PUBLIC_PATHS.account)}>
                    <Text style={styles.authInlineLinkText}>Account page</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={commonStyles.screen}>
      <ExpoStatusBar style="light" />
      <KeyboardAvoidingView style={styles.keyboardFrame} behavior={keyboardAvoidingBehavior}>
        <ScrollView
          ref={workspaceScrollRef}
          contentContainerStyle={[commonStyles.content, styles.workspaceContent]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          stickyHeaderIndices={[navStickyIndex]}
        >
          <View style={styles.workspaceOverview}>
            <View style={styles.workspaceOverviewCopy}>
              <Text style={commonStyles.muted}>Workspace overview</Text>
              <Text style={styles.workspaceOverviewTitle}>{currentPageTitle}</Text>
              <Text style={styles.workspaceOverviewMeta}>
                {session.user?.name || session.user?.email || 'Workspace user'}
                {billingSummary ? ` • ${billingSummary.planName}` : ''}
              </Text>
            </View>
            <View style={styles.workspaceOverviewActions}>
              <Pressable style={styles.workspaceOverviewAction} onPress={logout}>
                <Text style={styles.workspaceOverviewActionText}>Logout</Text>
              </Pressable>
              <Pressable style={styles.workspaceOverviewAction} onPress={() => setActiveTab('billing')}>
                <Text style={styles.workspaceOverviewActionText}>Manage Subscription</Text>
              </Pressable>
            </View>
          </View>
          {billingSummary?.entitlements?.creationBlocked ? (
            <Panel title="Upgrade to keep creating" subtitle="Free plan limit reached">
              <Text style={commonStyles.text}>
                New client and job creation is paused until {formatBillingResetDate(billingSummary.currentPeriodEndsAt)}.
              </Text>
              <Pressable style={[commonStyles.button, commonStyles.buttonPrimary]} onPress={() => setActiveTab('billing')}>
                <Text style={commonStyles.buttonText}>Open billing</Text>
              </Pressable>
            </Panel>
          ) : null}
          <View style={[commonStyles.panel, styles.stickyNavWrap]}>
            <Text style={commonStyles.muted}>Navigation</Text>
            <Pressable style={styles.navigationPrimaryAction} onPress={() => setActiveTab('jobs-new')}>
              <Text style={styles.navigationPrimaryActionText}>+ New Job</Text>
            </Pressable>
            <View style={styles.navRow}>
              {NAV_ITEMS.map((item) => (
                <Chip
                  key={item.key}
                  active={activeTab === item.key}
                  label={item.label}
                  onPress={() => setActiveTab(item.key)}
                  grow
                />
              ))}
            </View>
          </View>

          {activeTab === 'jobs' ? (
            <>
              <Panel title="All jobs">
                <Text style={commonStyles.text}>Jobs are grouped by date so the day plan is easier to scan on mobile.</Text>
                <View style={commonStyles.chip}><Text style={commonStyles.chipText}>Total payments {formatCurrency(jobs.reduce((sum, job) => sum + (Number(job.payment) || 0), 0))}</Text></View>
              </Panel>
              {jobsLoading ? <Panel><Text style={commonStyles.text}>Loading jobs...</Text></Panel> : null}
              {jobsError ? <Panel><Text style={commonStyles.errorText}>{jobsError}</Text></Panel> : null}
              {!jobsLoading && !jobsError && jobs.length === 0 ? (
                <Panel>
                  <Text style={commonStyles.text}>Create a job to view jobs</Text>
                </Panel>
              ) : null}
              {!jobsLoading && !jobsError ? jobsGroupedByDate.map((group) => (
                <Panel key={group.dateKey} title={group.title} subtitle={`${group.jobs.length} job${group.jobs.length === 1 ? '' : 's'}`}>
                  {group.jobs.map((job) => (
                    <JobCard key={job.id} job={job} onPress={() => setSelectedJob(job)} onDelete={() => confirmDeleteJob(job)} />
                  ))}
                </Panel>
              )) : null}
            </>
          ) : null}

          {activeTab === 'jobs-new' ? (
            <>
              <ScreenHero
                eyebrow="New work order"
                title="Create a job the field team can act on immediately"
                description="Capture the client, lock in the visit, and leave clean dispatch context without making the office fight a long form."
              />

              <WorkflowSection
                step="1"
                title="Confirm client details"
                description="Verify the contact information and service location before you book the work."
              >
                <Pressable
                  style={[commonStyles.button, commonStyles.buttonSecondary, styles.useExistingClientButton]}
                  onPress={() => {
                    setExistingClientPickerQuery('')
                    setExistingClientPickerVisible(true)
                  }}
                >
                  <Text style={commonStyles.buttonText}>Use Existing Client</Text>
                </Pressable>
                <FormField label="Client name" value={jobForm.name} onFocus={handleWorkspaceInputFocus} onChangeText={(value) => {
                  setJobForm((current) => ({ ...current, name: value }))
                  setJobErrors((current) => ({ ...current, name: '' }))
                  setJobStatus(null)
                }} error={jobErrors.name} placeholder="Jane Smith" helperText="Enter a new client name or adjust the selected client details here." />
                <FormField label="Phone" value={jobForm.phone} onFocus={handleWorkspaceInputFocus} onChangeText={(value) => {
                  setJobForm((current) => ({ ...current, phone: normalizePhoneDigits(value) }))
                  setJobErrors((current) => ({ ...current, phone: '' }))
                  setJobStatus(null)
                  setJobSuggestionField('phone')
                }} error={jobErrors.phone} keyboardType="phone-pad" maxLength={15} placeholder={PHONE_EXAMPLE} helperText={`Digits only. Preview: ${formatPhonePreview(jobForm.phone)}`} />
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
                  onCreateNew={() => setJobSuggestionField(null)}
                  createLabel="Keep this as a new client"
                />
                <FormField label="Service address" value={jobForm.address} onFocus={handleWorkspaceInputFocus} onChangeText={(value) => {
                  setJobForm((current) => ({ ...current, address: value }))
                  setJobErrors((current) => ({ ...current, address: '' }))
                  setJobStatus(null)
                  setJobSuggestionField('address')
                }} error={jobErrors.address} placeholder="123 Main St, Springfield, IL 62704" belowInput={<GoogleMapsLink address={jobForm.address} />} helperText="Include street, city, and unit details so the crew can find the appointment quickly." />
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
                  onCreateNew={() => setJobSuggestionField(null)}
                  createLabel="Use this address"
                />
              </WorkflowSection>

              <WorkflowSection
                step="2"
                title="Enter job details"
                description="Set the type of work, the price, and the notes that make the job operationally clear."
              >
                <JobTypeField label="Job type" value={jobForm.jobType} onChange={(value) => {
                  setJobForm((current) => ({ ...current, jobType: value }))
                  setJobErrors((current) => ({ ...current, jobType: '' }))
                  setJobStatus(null)
                }} error={jobErrors.jobType} options={jobTypeOptions} onFocus={handleWorkspaceInputFocus} helperText={jobTypeInputHelper} />
                <CurrencyField label="Quoted amount" value={jobForm.payment} onFocus={handleWorkspaceInputFocus} onChangeText={(value) => {
                  setJobForm((current) => ({ ...current, payment: value }))
                  setJobErrors((current) => ({ ...current, payment: '' }))
                  setJobStatus(null)
                }} error={jobErrors.payment} placeholder="0.00" />
                <View style={styles.inlineFieldRow}>
                  <View style={styles.inlineFieldColumn}>
                    <DateField label="Date" value={jobForm.jobDate} onChange={(value) => {
                      setJobForm((current) => ({ ...current, jobDate: value }))
                      setJobErrors((current) => ({ ...current, jobDate: '' }))
                      setJobStatus(null)
                    }} error={jobErrors.jobDate} />
                  </View>
                  <View style={styles.inlineFieldColumn}>
                    <TimeField label="Start time" value={jobForm.startTime} onChange={(value) => {
                      setJobForm((current) => ({ ...current, startTime: value }))
                      setJobErrors((current) => ({ ...current, startTime: '' }))
                      setJobStatus(null)
                    }} error={jobErrors.startTime} />
                  </View>
                </View>
                <FormField label="Dispatch notes" value={jobForm.comments} onFocus={handleWorkspaceInputFocus} onChangeText={(value) => {
                  setJobForm((current) => ({ ...current, comments: value }))
                  setJobErrors((current) => ({ ...current, comments: '' }))
                  setJobStatus(null)
                }} error={jobErrors.comments} multiline placeholder="Gate code 2468. Park in driveway. Customer prefers afternoon arrival." helperText="Add gate codes, parking notes, scope details, or anything the team should know before arrival." />
                <View style={styles.workflowHintCard}>
                  <Text style={styles.summaryCardLabel}>Schedule preview</Text>
                  <Text style={styles.summaryCardValue}>{jobCreationSchedule}</Text>
                </View>
              </WorkflowSection>

              <Panel title="Save the job" subtitle="Step 3">
                <Text style={commonStyles.text}>
                  {creationBlocked
                    ? `New client and job creation is paused until ${formatBillingResetDate(billingSummary?.currentPeriodEndsAt)}.`
                    : 'Create the job now so it is immediately available to office staff and technicians.'}
                </Text>
                {jobStatus ? <Text style={jobStatus.type === 'error' ? commonStyles.errorText : jobStatus.type === 'success' ? commonStyles.successText : commonStyles.text}>{jobStatus.message}</Text> : null}
                <Pressable style={[commonStyles.button, commonStyles.buttonPrimary, styles.primarySaveButton]} onPress={submitJob} disabled={creationBlocked}>
                  <Text style={commonStyles.buttonText}>{creationBlocked ? 'Upgrade or wait for reset' : 'Create Job'}</Text>
                </Pressable>
              </Panel>

              <Panel title="Manage job types" subtitle="Secondary setup">
                <Text style={commonStyles.text}>
                  Define the labels your business uses and choose the color that appears in the calendar.
                </Text>
                {jobTypeLimitMessage ? <Text style={commonStyles.helperText}>{jobTypeLimitMessage}</Text> : null}
                {!canManageJobTypes ? (
                  <View style={styles.jobTypesLockedCard}>
                    <Text style={commonStyles.errorText}>
                      Job type management is unavailable for this workspace.
                    </Text>
                    <Text style={commonStyles.helperText}>
                      Contact support if you expected to manage custom job types.
                    </Text>
                    {jobTypesError ? <Text style={commonStyles.errorText}>{jobTypesError}</Text> : null}
                  </View>
                ) : (
                  <>
                    <FormField
                      label="Name"
                      value={jobTypeDraft.name}
                      onFocus={handleWorkspaceInputFocus}
                      onChangeText={(value) => {
                        setJobTypeDraft((current) => ({ ...current, name: value }))
                        setJobTypeFormError('')
                      }}
                      placeholder="Mulch installation"
                      editable={!jobTypeSaving && (Boolean(jobTypeEditingId) || !jobTypeLimitReached)}
                      helperText={!jobTypeEditingId && jobTypeLimitReached ? `Free accounts can keep up to ${jobTypeLimit} custom job types. Edit or delete an unused type, or upgrade for unlimited job types.` : ''}
                    />
                    <Text style={commonStyles.label}>Color</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                      <View style={styles.colorPresetRow}>
                        {JOB_TYPE_COLOR_PRESETS.map((color) => {
                          const active = normalizeJobTypeColor(jobTypeDraft.color) === color
                          return (
                            <Pressable
                              key={color}
                              style={[styles.colorPreset, { backgroundColor: color }, active ? styles.colorPresetActive : null]}
                              onPress={() => {
                                setJobTypeDraft((current) => ({ ...current, color }))
                                setJobTypeFormError('')
                              }}
                              disabled={jobTypeSaving || (!jobTypeEditingId && jobTypeLimitReached)}
                            />
                          )
                        })}
                      </View>
                    </ScrollView>
                    <TextInput
                      style={commonStyles.input}
                      value={jobTypeDraft.color}
                      onFocus={handleWorkspaceInputFocus}
                      onChangeText={(value) => {
                        setJobTypeDraft((current) => ({ ...current, color: value }))
                        setJobTypeFormError('')
                      }}
                      placeholder="#6d7cff"
                      placeholderTextColor={colors.textMuted}
                      editable={!jobTypeSaving && (Boolean(jobTypeEditingId) || !jobTypeLimitReached)}
                    />
                    <View style={styles.jobTypeActionRow}>
                      {jobTypeEditingId ? (
                        <Pressable
                          style={[commonStyles.button, commonStyles.buttonSecondary, styles.jobTypeActionButton]}
                          onPress={resetJobTypeDraft}
                          disabled={jobTypeSaving}
                        >
                          <Text style={commonStyles.buttonText}>Cancel edit</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={[commonStyles.button, commonStyles.buttonPrimary, styles.jobTypeActionButton]}
                        onPress={submitJobTypeDraft}
                        disabled={jobTypeSaving || (!jobTypeEditingId && jobTypeLimitReached)}
                      >
                        <Text style={commonStyles.buttonText}>{jobTypeSaving ? 'Saving...' : jobTypeEditingId ? 'Save job type' : 'Add job type'}</Text>
                      </Pressable>
                    </View>
                    {jobTypeFormError ? <Text style={commonStyles.errorText}>{jobTypeFormError}</Text> : null}
                    {jobTypesError ? <Text style={commonStyles.errorText}>{jobTypesError}</Text> : null}
                    {jobTypesLoading ? (
                      <Text style={commonStyles.text}>Loading job types...</Text>
                    ) : jobTypes.length === 0 ? (
                      <Text style={commonStyles.text}>No job types yet. Add your first one above.</Text>
                    ) : (
                      <View style={styles.jobTypeList}>
                        {jobTypes.map((jobType) => {
                          const palette = getJobTypeColors(jobType.color || jobType.name, jobTypes)
                          return (
                            <View key={jobType.id || jobType.name} style={[styles.jobTypeListItem, { backgroundColor: palette.background, borderColor: palette.border }]}>
                              <View style={[styles.jobTypeSwatch, { backgroundColor: palette.background }]} />
                              <View style={styles.jobTypeListContent}>
                                <Text style={[commonStyles.heading3, { color: palette.text }]}>{jobType.name}</Text>
                                <Text style={[commonStyles.text, { color: palette.text }]}>{normalizeJobTypeColor(jobType.color) || palette.background}</Text>
                              </View>
                              <View style={styles.jobTypeListActions}>
                                <Pressable style={[styles.inlineActionButton, styles.inlineEditButton]} onPress={() => startEditingJobType(jobType)} disabled={jobTypeSaving}>
                                  <Text style={styles.inlineActionText}>Edit</Text>
                                </Pressable>
                                <Pressable style={[styles.inlineActionButton, styles.inlineDeleteButton]} onPress={() => removeJobType(jobType)} disabled={jobTypeSaving}>
                                  <Text style={styles.inlineActionText}>Delete</Text>
                                </Pressable>
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    )}
                  </>
                )}
              </Panel>
            </>
          ) : null}

          {activeTab === 'clients' ? (
            <>
              <View style={commonStyles.panel}>
                <Text style={commonStyles.sectionTitle}>Clients</Text>
                <TextInput style={commonStyles.input} value={clientSearch} onChangeText={setClientSearch} placeholder="Search by name, phone, or address" placeholderTextColor={colors.textMuted} />
              </View>
              {clients.length === 0 ? (
                <Panel>
                  <Text style={commonStyles.text}>Create a job to view clients</Text>
                </Panel>
              ) : null}
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

          {activeTab === 'billing' ? (
            <>
              <Panel title="Current plan" subtitle={billingSummary?.planName || 'Billing'}>
                {billingLoading && !billingSummary ? <Text style={commonStyles.text}>Loading billing details...</Text> : null}
                {billingError ? <Text style={commonStyles.errorText}>{billingError}</Text> : null}
                {billingSummary ? (
                  <>
                    <Text style={commonStyles.text}>
                      {billingSummary.planName} {billingSummary.priceLabel}
                    </Text>
                    <Text style={commonStyles.helperText}>
                      Resets on {formatBillingResetDate(billingSummary.currentPeriodEndsAt)}.
                    </Text>
                    {billingSummary.checkoutMode === 'manual_preview' ? (
                      <Text style={commonStyles.helperText}>
                        Plan changes save immediately for now while Stripe checkout is still being wired in.
                      </Text>
                    ) : null}
                    {billingSummary.checkoutMode !== 'manual_preview' && billingSummary.planCode !== 'free' ? (
                      <>
                        <Pressable
                          style={[commonStyles.button, commonStyles.buttonSecondary]}
                          onPress={openBillingPortal}
                          disabled={Boolean(billingSavingPlanCode)}
                        >
                          <Text style={commonStyles.buttonText}>
                            {billingSavingPlanCode === 'portal' ? 'Opening Stripe...' : 'Manage subscription'}
                          </Text>
                        </Pressable>
                        <Text style={commonStyles.helperText}>
                          Use Stripe to cancel your subscription and stop future billing.
                        </Text>
                      </>
                    ) : null}
                    <View style={styles.billingUsageList}>
                      <View style={commonStyles.chip}>
                        <Text style={commonStyles.chipText}>
                          {billingSummary.usage.monthlyClientLimit === null
                            ? 'Unlimited clients'
                            : `${billingSummary.usage.monthlyClientCreations}/${billingSummary.usage.monthlyClientLimit} clients`}
                        </Text>
                      </View>
                      <View style={commonStyles.chip}>
                        <Text style={commonStyles.chipText}>
                          {billingSummary.usage.monthlyJobLimit === null
                            ? 'Unlimited jobs'
                            : `${billingSummary.usage.monthlyJobCreations}/${billingSummary.usage.monthlyJobLimit} jobs`}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : null}
              </Panel>
              {!billingSummary ? (
                <Panel>
                  <Text style={commonStyles.helperText}>
                    Showing the default plan catalog while billing details load. If this persists, check the backend log for the billing summary error.
                  </Text>
                </Panel>
              ) : null}
              {billingPlans.map((plan) => {
                const isCurrent = billingSummary?.planCode === plan.code
                const isSelectable = SELF_SERVE_PLAN_CODES.includes(plan.code)
                return (
                  <View key={plan.code} style={commonStyles.panel}>
                    <View style={commonStyles.rowBetween}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={commonStyles.sectionTitle}>{plan.name}</Text>
                        <Text style={commonStyles.text}>{plan.description}</Text>
                      </View>
                      <Text style={commonStyles.heading3}>{plan.priceLabel}</Text>
                    </View>
                    <Text style={commonStyles.helperText}>
                      {plan.userLimit === null ? 'Custom seats' : `${plan.userLimit} user${plan.userLimit === 1 ? '' : 's'}`}
                    </Text>
                    {Array.isArray(plan.features) ? plan.features.map((feature) => (
                      <Text key={`${plan.code}-${feature}`} style={commonStyles.text}>• {feature}</Text>
                    )) : null}
                    {isSelectable ? (
                      <Pressable
                        style={[commonStyles.button, isCurrent ? commonStyles.buttonSecondary : commonStyles.buttonPrimary]}
                        onPress={() => selectPlan(plan.code)}
                        disabled={Boolean(billingSavingPlanCode)}
                      >
                        <Text style={commonStyles.buttonText}>
                          {billingSavingPlanCode === plan.code
                            ? 'Saving...'
                            : isCurrent
                              ? 'Current plan'
                              : billingSummary?.planCode === 'free'
                                ? `Choose ${plan.name}`
                                : 'Open Stripe'}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable style={[commonStyles.button, commonStyles.buttonSecondary]} disabled>
                        <Text style={commonStyles.buttonText}>Contact sales</Text>
                      </Pressable>
                    )}
                  </View>
                )
              })}
              <Panel title="Policy and support" subtitle="Store-readiness links">
                <Text style={commonStyles.text}>
                  Open the public privacy, support, and account-management pages from the same web app customers can use outside the mobile app.
                </Text>
                <Text style={commonStyles.helperText}>{APP_WEB_BASE}</Text>
                <View style={styles.jobTypeActionRow}>
                  <Pressable
                    style={[commonStyles.button, commonStyles.buttonSecondary, styles.jobTypeActionButton]}
                    onPress={() => openPublicPage(PUBLIC_PATHS.privacy)}
                  >
                    <Text style={commonStyles.buttonText}>Privacy</Text>
                  </Pressable>
                  <Pressable
                    style={[commonStyles.button, commonStyles.buttonSecondary, styles.jobTypeActionButton]}
                    onPress={() => openPublicPage(PUBLIC_PATHS.account)}
                  >
                    <Text style={commonStyles.buttonText}>Account page</Text>
                  </Pressable>
                </View>
                <Pressable style={[commonStyles.button, commonStyles.buttonSecondary]} onPress={openSupportContact}>
                  <Text style={commonStyles.buttonText}>{SUPPORT_EMAIL ? 'Email support' : 'Open support page'}</Text>
                </Pressable>
              </Panel>
              <Panel title="Delete account" subtitle="Permanent action">
                <Text style={commonStyles.text}>
                  Remove this workspace account and its stored data. Paid Stripe subscriptions may need to be cancelled first.
                </Text>
                <FormField
                  label="Current password"
                  value={accountDeletionForm.password}
                  onChangeText={(value) => {
                    setAccountDeletionForm((current) => ({ ...current, password: value }))
                    setAccountDeletionStatus('')
                  }}
                  secureTextEntry
                  placeholder="Enter your current password"
                />
                <FormField
                  label='Type DELETE to confirm'
                  value={accountDeletionForm.confirmText}
                  onChangeText={(value) => {
                    setAccountDeletionForm((current) => ({ ...current, confirmText: value }))
                    setAccountDeletionStatus('')
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="DELETE"
                />
                <Pressable
                  style={[commonStyles.button, styles.deleteButton]}
                  onPress={submitAccountDeletion}
                  disabled={accountDeletionSubmitting}
                >
                  <Text style={commonStyles.buttonText}>
                    {accountDeletionSubmitting ? 'Deleting account...' : 'Delete account'}
                  </Text>
                </Pressable>
                {accountDeletionStatus ? (
                  <Text style={accountDeletionStatus.toLowerCase().includes('unable') || accountDeletionStatus.toLowerCase().includes('incorrect') ? commonStyles.errorText : commonStyles.successText}>
                    {accountDeletionStatus}
                  </Text>
                ) : null}
              </Panel>
              {billingStatus ? (
                <Panel>
                  <Text style={billingStatus.toLowerCase().includes('unable') ? commonStyles.errorText : commonStyles.successText}>
                    {billingStatus}
                  </Text>
                </Panel>
              ) : null}
            </>
          ) : null}

          {activeTab === 'calendar' ? (
            <>
              <View style={commonStyles.panel}>
                <View style={styles.calendarTitleRow}>
                  <Text style={commonStyles.sectionTitle}>Job calendar</Text>
                  <Text style={styles.calendarRangeInline}>{getCalendarRangeLabel(calendarView, calendarAnchorDate)}</Text>
                </View>
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
                {calendarView !== 'day' ? (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                      <View style={styles.calendarControls}>
                        <Chip label="Previous" onPress={() => stepCalendar(-1)} />
                        <Chip label="Today" active onPress={jumpCalendarToToday} />
                        <Chip label="Next" onPress={() => stepCalendar(1)} />
                      </View>
                    </ScrollView>
                    <Pressable
                      style={[commonStyles.button, commonStyles.buttonSecondary, styles.calendarLegendToggle]}
                      onPress={() => setCalendarJobTypesVisible((current) => !current)}
                    >
                      <Text style={commonStyles.buttonText}>
                        {calendarJobTypesVisible ? 'Hide Job Types' : 'View Job Types'}
                      </Text>
                    </Pressable>
                    {calendarJobTypesVisible ? renderCalendarLegend() : null}
                  </>
                ) : null}
              </View>
              {renderCalendarContent()}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <ExistingClientPicker
        visible={existingClientPickerVisible}
        clients={existingClientPickerClients}
        query={existingClientPickerQuery}
        onChangeQuery={setExistingClientPickerQuery}
        onClose={() => setExistingClientPickerVisible(false)}
        onSelect={(client) => {
          setJobForm((current) => ({ ...current, ...applyClientDetails(client) }))
          setJobErrors((current) => ({ ...current, name: '', phone: '', address: '' }))
          setJobStatus(null)
          setExistingClientPickerVisible(false)
        }}
      />
      <JobModal job={selectedJob} clients={clients} jobTypes={jobTypes} onClose={() => setSelectedJob(null)} onSave={saveJobUpdates} onDelete={confirmDeleteJob} />
      <ClientModal client={selectedClient} clients={clients} onClose={() => setSelectedClient(null)} onSave={saveClientUpdates} />
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
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

function ScreenHero({ eyebrow, title, description, children }) {
  return (
    <View style={styles.screenHero}>
      {eyebrow ? <Text style={commonStyles.muted}>{eyebrow}</Text> : null}
      <Text style={styles.screenHeroTitle}>{title}</Text>
      {description ? <Text style={commonStyles.text}>{description}</Text> : null}
      {children}
    </View>
  )
}

function WorkflowSection({ step, title, description, children }) {
  return (
    <View style={styles.workflowSection}>
      <View style={styles.workflowSectionHeader}>
        <View style={styles.workflowStepBadge}>
          <Text style={styles.workflowStepText}>{step}</Text>
        </View>
        <View style={styles.workflowSectionCopy}>
          <Text style={styles.workflowSectionTitle}>{title}</Text>
          {description ? <Text style={commonStyles.text}>{description}</Text> : null}
        </View>
      </View>
      <View style={styles.workflowSectionBody}>{children}</View>
    </View>
  )
}

function ExistingClientPicker({ visible, clients, query, onChangeQuery, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView style={styles.keyboardFrame} behavior={keyboardAvoidingBehavior}>
          <View style={styles.modalPanel}>
            <View style={styles.modalContent}>
              <Text style={commonStyles.sectionTitle}>Use existing client</Text>
              <Text style={commonStyles.text}>Choose an existing client record instead of typing everything again.</Text>
              <TextInput
                style={commonStyles.input}
                value={query}
                onChangeText={onChangeQuery}
                placeholder="Search by name, phone, or address"
                placeholderTextColor={colors.textMuted}
              />
              <ScrollView
                style={styles.existingClientList}
                contentContainerStyle={styles.existingClientListContent}
                keyboardShouldPersistTaps="handled"
              >
                {clients.length === 0 ? (
                  <View style={styles.existingClientEmpty}>
                    <Text style={commonStyles.text}>No matching clients found.</Text>
                  </View>
                ) : (
                  clients.map((client) => (
                    <Pressable
                      key={client.id}
                      style={({ pressed }) => [
                        styles.existingClientItem,
                        pressed ? styles.suggestionItemPressed : null
                      ]}
                      onPress={() => onSelect(client)}
                    >
                      <Text style={styles.suggestionName}>{client.name || 'No name'}</Text>
                      <Text style={styles.suggestionMeta}>{formatPhonePreview(client.phone)}</Text>
                      <Text style={styles.suggestionMeta}>{client.address || 'No address'}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
              <Pressable style={[commonStyles.button, commonStyles.buttonSecondary]} onPress={onClose}>
                <Text style={commonStyles.buttonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

function FormField({ label, error, helperText, belowInput = null, multiline, labelStyle, inputStyle, ...props }) {
  return (
    <View>
      <Text style={[commonStyles.label, labelStyle]}>{label}</Text>
      <TextInput style={[commonStyles.input, multiline ? styles.multiline : null, inputStyle]} placeholderTextColor={colors.textMuted} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} {...props} />
      {belowInput}
      {helperText ? <Text style={commonStyles.helperText}>{helperText}</Text> : null}
      {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}
    </View>
  )
}

function ClientSuggestions({ clients, query, field, visible, onSelect, onCreateNew, createLabel = 'Create New Client' }) {
  const matches = visible ? getClientSuggestions(clients, query, field).slice(0, 6) : []
  const hasQuery = String(query || '').trim().length > 0

  if (!visible || (!hasQuery && matches.length === 0)) return null

  return (
    <View style={styles.suggestionBox}>
      <View style={styles.suggestionHeader}>
        <View style={styles.suggestionHeaderCopy}>
          <Text style={styles.suggestionHeaderTitle}>Client matches</Text>
          <Text style={styles.suggestionHeaderText}>Choose an existing client or continue with a new one.</Text>
        </View>
        {hasQuery && onCreateNew ? (
          <Pressable style={styles.suggestionCreateButton} onPress={onCreateNew}>
            <Text style={styles.suggestionCreateText}>{createLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {matches.length === 0 ? (
        <View style={styles.suggestionEmpty}>
          <Text style={styles.suggestionHeaderText}>No close matches yet. Continue with this as a new client.</Text>
        </View>
      ) : null}
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

function JobTypeField({ label, value, onChange, error, options = [], helperText, onFocus }) {
  const normalizedValue = normalizeJobTypeKey(value)
  const [pickerVisible, setPickerVisible] = useState(false)
  const hasExistingOptions = options.length > 0

  return (
    <View>
      <FormField
        label={label}
        value={value}
        onFocus={onFocus}
        onChangeText={onChange}
        placeholder={options.length > 0 ? 'Enter or select a job type' : 'Enter a job type'}
        helperText={helperText}
        error={error}
      />
      {hasExistingOptions ? (
        <>
          <Pressable
            style={styles.jobTypePickerButton}
            onPress={() => setPickerVisible(true)}
          >
            <Text style={styles.jobTypePickerButtonText}>Select from existing job types</Text>
          </Pressable>
          <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.dateModalPanel}>
                <Text style={commonStyles.sectionTitle}>Select job type</Text>
                <Text style={commonStyles.text}>Choose a saved job type or close this list to enter a new one.</Text>
                <ScrollView style={styles.optionList} keyboardShouldPersistTaps="handled">
                  {options.map((jobType) => {
                    const name = jobType.name || ''
                    const active = Boolean(normalizedValue) && normalizeJobTypeKey(name) === normalizedValue
                    return (
                      <Pressable
                        key={jobType.id || name}
                        style={[styles.optionRow, active ? styles.optionRowActive : null]}
                        onPress={() => {
                          onChange(name)
                          setPickerVisible(false)
                        }}
                      >
                        <Text style={styles.optionText}>{name}</Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
                <Pressable style={[commonStyles.button, commonStyles.buttonSecondary]} onPress={() => setPickerVisible(false)}>
                  <Text style={commonStyles.buttonText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </>
      ) : null}
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
        <Text style={styles.dateFieldHint}>{value ? `Start time: ${value}` : 'HH:MM'}</Text>
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
    <View style={styles.jobsListItem}>
      <Pressable style={styles.jobCardContent} onPress={onPress}>
        <Text style={commonStyles.heading3}>{job.name || 'No client'}</Text>
        <Text style={commonStyles.text}>{formatDate(job.job_date)}</Text>
        <Text style={commonStyles.text}>{job.job_type || 'No job type'}</Text>
        <Text style={styles.jobCardPayment}>Payment: {formatCurrency(job.payment)}</Text>
      </Pressable>
      <View style={styles.jobCardActionsTopRight}>
        <Pressable style={[styles.inlineActionButton, styles.inlineEditButton]} onPress={onPress}>
          <Text style={styles.inlineActionText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.iconDeleteButton} onPress={onDelete}>
          <Text style={styles.iconDeleteText}>X</Text>
        </Pressable>
      </View>
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
              }} placeholder="123 Main St, Springfield, IL 62704" belowInput={<GoogleMapsLink address={formState?.address || ''} />} helperText="Include street, city, and any unit details so the crew can find the appointment quickly." />
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

function JobModal({ job, clients, jobTypes = [], onClose, onSave, onDelete }) {
  const [formState, setFormState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suggestionField, setSuggestionField] = useState(null)
  const jobTypeOptions = useMemo(() => [...jobTypes].sort((first, second) => {
    const firstOrder = Number(first.sort_order ?? 0)
    const secondOrder = Number(second.sort_order ?? 0)
    if (firstOrder !== secondOrder) return firstOrder - secondOrder
    return normalizeJobTypeName(first.name).localeCompare(normalizeJobTypeName(second.name))
  }), [jobTypes])

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
              }} placeholder="123 Main St, Springfield, IL 62704" belowInput={<GoogleMapsLink address={formState?.address || ''} />} helperText="Include street, city, and any unit details so the crew can find the appointment quickly." />
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
              <JobTypeField label="Job type" value={formState?.jobType || ''} onChange={(value) => setFormState((current) => ({ ...current, jobType: value }))} options={jobTypeOptions} helperText={jobTypeOptions.length > 0 ? 'Type a new job type or choose an existing one below.' : 'Enter a job type for this job.'} />
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
  authScreen: {
    backgroundColor: '#07111f'
  },
  authScrollContent: {
    flexGrow: 1
  },
  authScrollContentForm: {
    paddingTop: 0
  },
  authBackdrop: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#07111f',
    overflow: 'hidden'
  },
  authBackdropForm: {
    justifyContent: 'flex-start'
  },
  authGlowTop: {
    position: 'absolute',
    top: -110,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(109, 124, 255, 0.34)'
  },
  authGlowBottom: {
    position: 'absolute',
    bottom: 180,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(52, 211, 153, 0.18)'
  },
  authGrid: {
    position: 'absolute',
    top: 72,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '16deg' }]
  },
  authHero: {
    flex: 1,
    minHeight: 520,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 54,
    paddingBottom: 40,
    gap: 14
  },
  authHeroCompact: {
    flex: 0,
    minHeight: 0,
    paddingTop: 24,
    paddingBottom: 14,
    gap: 6
  },
  authEyebrow: {
    color: 'rgba(226, 232, 240, 0.9)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase'
  },
  authEyebrowCompact: {
    fontSize: 10,
    lineHeight: 13
  },
  authMonogram: {
    width: 128,
    height: 128,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  authMonogramCompact: {
    width: 62,
    height: 62,
    borderRadius: 18
  },
  authMonogramText: {
    color: '#f8fafc',
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -2
  },
  authMonogramTextCompact: {
    fontSize: 24,
    letterSpacing: 0
  },
  authWordmarkPrimary: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1.6,
    textAlign: 'center'
  },
  authWordmarkCompact: {
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: 1
  },
  authWordmarkAccent: {
    color: '#a855f7',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1.6,
    textAlign: 'center',
    marginTop: -12
  },
  authWordmarkAccentCompact: {
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: 1,
    marginTop: -8
  },
  authHeroTitle: {
    color: '#e2e8f0',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 360
  },
  authHeroTitleCompact: {
    display: 'none'
  },
  authHeroStatus: {
    color: 'rgba(226, 232, 240, 0.78)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320
  },
  authHeroStatusCompact: {
    display: 'none'
  },
  authHeroStatusError: {
    color: '#fda4af',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320
  },
  authSheet: {
    marginTop: 'auto',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18
  },
  authSheetForm: {
    marginTop: 0,
    paddingTop: 14,
    paddingBottom: 24
  },
  authCtaStack: {
    gap: 14
  },
  authFormWrap: {
    gap: 14
  },
  authFormHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14
  },
  authFormCopy: {
    flex: 1,
    gap: 4
  },
  authFormEyebrow: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  authFormTitle: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8
  },
  authFormText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20
  },
  authBackLink: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
    paddingTop: 2
  },
  authInputLabel: {
    color: '#0f172a'
  },
  authInput: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(15, 23, 42, 0.12)',
    color: '#0f172a'
  },
  authPrimaryButton: {
    backgroundColor: '#a855f7',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.38)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#a855f7',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  authPrimaryButtonGlow: {
    position: 'absolute',
    top: -18,
    left: -10,
    width: 150,
    height: 70,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)'
  },
  authPrimaryButtonGlowSecondary: {
    position: 'absolute',
    right: -18,
    bottom: -20,
    width: 130,
    height: 72,
    borderRadius: 999,
    backgroundColor: 'rgba(192, 132, 252, 0.28)'
  },
  authPrimaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
    zIndex: 1
  },
  authSecondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.12)'
  },
  authSecondaryButtonText: {
    color: '#a855f7',
    fontWeight: '900',
    fontSize: 16
  },
  authModeSwitch: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    paddingTop: 4
  },
  authInlineLinkText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700'
  },
  keyboardFrame: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  workspaceContent: {
    paddingTop: 14
  },
  workspaceOverview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel
  },
  workspaceOverviewCopy: {
    flex: 1,
    gap: 4
  },
  workspaceOverviewTitle: {
    color: colors.heading,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  workspaceOverviewMeta: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  workspaceOverviewActions: {
    width: 156,
    gap: 8,
    alignItems: 'stretch'
  },
  workspaceOverviewAction: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)'
  },
  workspaceOverviewActionText: {
    color: colors.heading,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center'
  },
  stickyNavWrap: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    zIndex: 10,
    paddingTop: 20,
    paddingBottom: 20
  },
  navigationPrimaryAction: {
    minHeight: 46,
    marginBottom: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.accentStrong,
    shadowColor: colors.accent,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  navigationPrimaryActionText: {
    color: colors.heading,
    fontSize: 14,
    fontWeight: '800'
  },
  screenHero: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: 18,
    gap: 10
  },
  screenHeroTitle: {
    color: colors.heading,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6
  },
  workflowSection: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 16,
    gap: 14
  },
  workflowSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  workflowStepBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109, 124, 255, 0.18)',
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  workflowStepText: {
    color: colors.heading,
    fontSize: 13,
    fontWeight: '800'
  },
  workflowSectionCopy: {
    flex: 1,
    gap: 4
  },
  workflowSectionTitle: {
    color: colors.heading,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  workflowSectionBody: {
    gap: 14
  },
  summaryCardLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  summaryCardValue: {
    color: colors.heading,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21
  },
  workflowHintCard: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(109, 124, 255, 0.1)',
    gap: 6
  },
  inlineFieldRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start'
  },
  inlineFieldColumn: {
    flex: 1
  },
  useExistingClientButton: {
    alignSelf: 'flex-start',
    minWidth: 180
  },
  tabs: { flexDirection: 'row', gap: 8 },
  navRow: { flexDirection: 'row', gap: 10, width: '100%' },
  chip: {
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 1
  },
  chipActive: { backgroundColor: 'rgba(109, 124, 255, 0.18)', borderColor: colors.borderStrong },
  chipGrow: { flex: 1 },
  chipText: { color: colors.heading, fontWeight: '700', fontSize: 13, textAlign: 'center' },
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
  jobsListItem: {
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 14,
    gap: 12
  },
  jobCardActionsTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  jobCardPayment: {
    color: colors.heading,
    fontSize: 15,
    fontWeight: '800'
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
  existingClientList: {
    maxHeight: 320
  },
  existingClientListContent: {
    gap: 10,
    paddingTop: 4
  },
  existingClientItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.card
  },
  existingClientEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.card
  },
  suggestionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 10
  },
  suggestionHeaderCopy: {
    gap: 4
  },
  suggestionHeaderTitle: {
    color: colors.heading,
    fontSize: 14,
    fontWeight: '800'
  },
  suggestionHeaderText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18
  },
  suggestionCreateButton: {
    minHeight: 34,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109, 124, 255, 0.14)',
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  suggestionCreateText: {
    color: colors.heading,
    fontSize: 12,
    fontWeight: '800'
  },
  suggestionEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
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
  inlineLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  inlineLinkText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
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
  calendarTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  calendarDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  calendarRangeInline: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1
  },
  calendarGrossSubtext: {
    color: colors.heading,
    fontSize: 13,
    fontWeight: '800'
  },
  calendarLegendToggle: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16
  },
  calendarInlineToggle: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  calendarInlineToggleActive: {
    backgroundColor: 'rgba(109, 124, 255, 0.16)',
    borderColor: 'rgba(109, 124, 255, 0.36)'
  },
  calendarInlineToggleText: {
    color: colors.heading,
    fontSize: 12,
    fontWeight: '800'
  },
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
  billingUsageList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  colorPresetRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 6
  },
  colorPreset: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  colorPresetActive: {
    borderColor: colors.heading,
    transform: [{ scale: 1.08 }]
  },
  jobTypePickerButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    marginTop: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(109, 124, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  jobTypePickerButtonText: {
    color: colors.heading,
    fontSize: 13,
    fontWeight: '800'
  },
  jobTypeActionRow: {
    flexDirection: 'row',
    gap: 12
  },
  jobTypeActionButton: {
    flex: 1
  },
  jobTypesLockedCard: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(109, 124, 255, 0.28)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(109, 124, 255, 0.06)'
  },
  jobTypeList: {
    gap: 10,
    marginTop: 4
  },
  jobTypeListItem: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  jobTypeSwatch: {
    width: 14,
    height: 14,
    borderRadius: 999
  },
  jobTypeListContent: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  jobTypeListActions: {
    flexDirection: 'row',
    gap: 8
  },
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
  calendarDaySummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  calendarDayActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14
  },
  calendarDayLegendWrap: {
    marginTop: 14
  },
  calendarGrossIncomeText: {
    color: colors.heading,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: -1
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
  monthCellGross: { color: colors.heading, fontSize: 11, fontWeight: '800' },
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
  },
  primarySaveButton: {
    minHeight: 58,
    borderRadius: 20
  }
})
