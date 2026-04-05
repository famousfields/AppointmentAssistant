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
  { key: 'jobs', label: 'Jobs' },
  { key: 'jobs-new', label: 'New Job' },
  { key: 'clients', label: 'Clients' },
  { key: 'calendar', label: 'Calendar' }
]

const JOB_STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']

const EMPTY_JOB_FORM = {
  name: '',
  phone: '',
  address: '',
  jobType: '',
  jobDate: '',
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

const keyboardAvoidingBehavior = Platform.OS === 'ios' ? 'padding' : 'height'

const buildJobPayload = (job) => ({
  ...job,
  jobDate: formatDateValue(job.jobDate),
  payment: job.payment === '' ? 0 : Number(job.payment)
})

const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

const buildCalendarGroups = (jobs, visibleMonth) => {
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const groups = new Map()

  jobs.forEach((job) => {
    const date = parseDateValue(job.job_date)
    if (!date) return
    if (date.getFullYear() !== year || date.getMonth() !== month) return
    const key = toDateKey(date)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(job)
  })

  return Array.from(groups.entries())
    .sort(([a], [b]) => getDateTimestamp(a) - getDateTimestamp(b))
    .map(([date, dayJobs]) => ({ date, jobs: dayJobs }))
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState(null)
  const [apiHealth, setApiHealth] = useState({ status: 'checking', message: 'Checking backend...' })
  const [activeTab, setActiveTab] = useState('jobs')
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
  const [clientSearch, setClientSearch] = useState('')
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

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
  const calendarGroups = useMemo(() => buildCalendarGroups(jobs, visibleMonth), [jobs, visibleMonth])

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
        return value.trim() ? '' : 'Choose or enter the type of job you are scheduling.'
      case 'jobDate':
        return parseDateValue(value) ? '' : 'Pick a valid date for this appointment.'
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
        setActiveTab('jobs')
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
      setJobStatus({ type: 'success', message: 'Job created successfully' })
      await clearJobDraft()
      setActiveTab('jobs')
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
              }} error={jobErrors.name} />
              <FormField label="Phone" value={jobForm.phone} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, phone: value.replace(/\D/g, '') }))
                setJobErrors((current) => ({ ...current, phone: '' }))
                setJobStatus(null)
              }} error={jobErrors.phone} />
              <FormField label="Address" value={jobForm.address} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, address: value }))
                setJobErrors((current) => ({ ...current, address: '' }))
                setJobStatus(null)
              }} error={jobErrors.address} />
              <FormField label="Job type" value={jobForm.jobType} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, jobType: value }))
                setJobErrors((current) => ({ ...current, jobType: '' }))
                setJobStatus(null)
              }} error={jobErrors.jobType} />
              <DateField label="Date" value={jobForm.jobDate} onChange={(value) => {
                setJobForm((current) => ({ ...current, jobDate: value }))
                setJobErrors((current) => ({ ...current, jobDate: '' }))
                setJobStatus(null)
              }} error={jobErrors.jobDate} />
              <CurrencyField label="Payment" value={jobForm.payment} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, payment: value }))
                setJobErrors((current) => ({ ...current, payment: '' }))
                setJobStatus(null)
              }} error={jobErrors.payment} placeholder="0.00" />
              <FormField label="Comments" value={jobForm.comments} onChangeText={(value) => {
                setJobForm((current) => ({ ...current, comments: value }))
                setJobErrors((current) => ({ ...current, comments: '' }))
                setJobStatus(null)
              }} error={jobErrors.comments} multiline />
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
                <View style={styles.calendarControls}>
                  <Chip label="Previous" onPress={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} />
                  <Chip label="Current" active onPress={() => { const today = new Date(); setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1)) }} />
                  <Chip label="Next" onPress={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} />
                </View>
                <Text style={commonStyles.heading3}>{formatMonth(visibleMonth)}</Text>
              </View>
              {calendarGroups.map((group) => (
                <View key={group.date} style={commonStyles.panel}>
                  <Text style={commonStyles.heading3}>{formatDate(group.date)}</Text>
                  {group.jobs.map((job) => (
                    <View key={job.id} style={styles.inlineCard}>
                      <View style={commonStyles.rowBetween}>
                        <Pressable style={styles.inlineContentButton} onPress={() => setSelectedJob(job)}>
                          <Text style={styles.inlineTitle}>{job.name}</Text>
                          <Text style={commonStyles.text}>{job.job_type} - {formatCurrency(job.payment)}</Text>
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
        </ScrollView>
      </KeyboardAvoidingView>
      <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} onSave={saveJobUpdates} onDelete={confirmDeleteJob} />
      <ClientModal client={selectedClient} onClose={() => setSelectedClient(null)} onSave={saveClientUpdates} />
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

function FormField({ label, error, multiline, ...props }) {
  return (
    <View>
      <Text style={commonStyles.label}>{label}</Text>
      <TextInput style={[commonStyles.input, multiline ? styles.multiline : null]} placeholderTextColor={colors.textMuted} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} {...props} />
      {error ? <Text style={commonStyles.errorText}>{error}</Text> : null}
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
            <Text style={commonStyles.sectionTitle}>Choose a status</Text>
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
  return <Chip label={label} active={active} onPress={onPress} grow />
}

function Chip({ active, label, onPress, grow }) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipActive : null, grow ? styles.chipGrow : null]} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
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
        <Text style={commonStyles.text}>{job.job_type}</Text>
        <Text style={commonStyles.text}>{job.phone || '-'}</Text>
        <Text style={commonStyles.text}>{job.address || '-'}</Text>
        <Text style={commonStyles.text}>Payment: {formatCurrency(job.payment)}</Text>
        <Text style={commonStyles.text}>{job.comments || 'No notes yet'}</Text>
      </Pressable>
    </View>
  )
}

function ClientModal({ client, onClose, onSave }) {
  const [formState, setFormState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client) {
      setFormState(null)
      setSaving(false)
      setError('')
      return
    }

    setFormState({
      name: client.name || '',
      phone: client.phone || '',
      address: client.address || ''
    })
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
              <FormField label="Client name" value={formState?.name || ''} onChangeText={(value) => setFormState((current) => ({ ...current, name: value }))} />
              <FormField label="Phone" value={formState?.phone || ''} onChangeText={(value) => setFormState((current) => ({ ...current, phone: value.replace(/\D/g, '') }))} />
              <FormField label="Address" value={formState?.address || ''} onChangeText={(value) => setFormState((current) => ({ ...current, address: value }))} />
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

function JobModal({ job, onClose, onSave, onDelete }) {
  const [formState, setFormState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!job) {
      setFormState(null)
      setSaving(false)
      setError('')
      return
    }

    setFormState({
      name: job.name || '',
      phone: job.phone || '',
      address: job.address || '',
      jobType: job.job_type || '',
      jobDate: formatDateValue(job.job_date),
      payment: job.payment === null || job.payment === undefined ? '' : String(job.payment),
      comments: job.comments || '',
      status: job.status || 'Pending'
    })
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
              <FormField label="Client name" value={formState?.name || ''} onChangeText={(value) => setFormState((current) => ({ ...current, name: value }))} />
              <FormField label="Phone" value={formState?.phone || ''} onChangeText={(value) => setFormState((current) => ({ ...current, phone: value.replace(/\D/g, '') }))} />
              <FormField label="Address" value={formState?.address || ''} onChangeText={(value) => setFormState((current) => ({ ...current, address: value }))} />
              <FormField label="Job type" value={formState?.jobType || ''} onChangeText={(value) => setFormState((current) => ({ ...current, jobType: value }))} />
              <DateField label="Date" value={formState?.jobDate || ''} onChange={(value) => setFormState((current) => ({ ...current, jobDate: value }))} />
              <SelectField label="Status" value={formState?.status || ''} onChange={(value) => setFormState((current) => ({ ...current, status: value }))} options={JOB_STATUS_OPTIONS} />
              <CurrencyField label="Payment" value={formState?.payment || ''} onChangeText={(value) => setFormState((current) => ({ ...current, payment: value }))} placeholder="0.00" />
              <FormField label="Comments" value={formState?.comments || ''} onChangeText={(value) => setFormState((current) => ({ ...current, comments: value }))} multiline />
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
                <Text style={commonStyles.chipText}>Original date {formatDate(job.job_date)}</Text>
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
  navRow: { flexDirection: 'row', gap: 10 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border
  },
  chipActive: { backgroundColor: 'rgba(109, 124, 255, 0.18)', borderColor: colors.borderStrong },
  chipGrow: { flex: 1 },
  chipText: { color: colors.heading, fontWeight: '700' },
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
  calendarControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
