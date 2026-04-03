import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
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

const EMPTY_JOB_FORM = {
  name: '',
  phone: '',
  address: '',
  jobType: '',
  jobDate: '',
  payment: '',
  comments: ''
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
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
      jobs: [...client.jobs].sort((a, b) => new Date(b.job_date) - new Date(a.job_date)),
      totalPayments: client.jobs.reduce((sum, job) => sum + (Number(job.payment) || 0), 0)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const buildCalendarGroups = (jobs, visibleMonth) => {
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const groups = new Map()

  jobs.forEach((job) => {
    const date = new Date(job.job_date)
    if (Number.isNaN(date.getTime())) return
    if (date.getFullYear() !== year || date.getMonth() !== month) return
    const key = toDateKey(date)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(job)
  })

  return Array.from(groups.entries())
    .sort(([a], [b]) => new Date(a) - new Date(b))
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
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '', email: '', confirmPassword: '' })
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
            message: `Connected to ${API_BASE}`
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
        return value.trim().length >= 2 ? '' : 'Enter a valid name'
      case 'phone': {
        const digits = value.replace(/\D/g, '')
        return digits.length >= 7 && digits.length <= 15 ? '' : 'Phone must be 7-15 digits'
      }
      case 'address':
        return value.trim().length >= 5 ? '' : 'Enter a valid address'
      case 'jobType':
        return value.trim() ? '' : 'Job type is required'
      case 'jobDate':
        return value ? '' : 'Date is required'
      case 'payment':
        return !value || /^\d+(\.\d{0,2})?$/.test(value) ? '' : 'Payment must be a valid amount'
      case 'comments':
        return value.length <= 500 ? '' : 'Comments max 500 chars'
      default:
        return ''
    }
  }

  const submitAuth = async () => {
    const isCreate = authMode === 'create'
    if (isCreate && authForm.password !== authForm.confirmPassword) {
      setAuthStatus({ type: 'error', message: 'Passwords must match' })
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
      setAuthStatus({ type: 'error', message: error.message || 'Unable to reach server' })
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
    if (Object.keys(nextErrors).length > 0 || !session) return

    setJobStatus({ type: 'info', message: 'Saving appointment...' })
    try {
      const response = await apiFetch('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          ...jobForm,
          payment: jobForm.payment === '' ? 0 : Number(jobForm.payment)
        }),
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
      setJobStatus({ type: 'error', message: error.message || 'Unable to create job' })
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
      body: JSON.stringify({
        ...updates,
        payment: updates.payment === '' ? 0 : Number(updates.payment)
      }),
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
        <ScrollView contentContainerStyle={commonStyles.content}>
          <Panel title="Appointment Assistant" subtitle="Appointment toolkit">
            <Text style={commonStyles.text}>
              This mobile client mirrors the web frontend with stacked cards and touch-friendly controls.
            </Text>
            <View style={commonStyles.chip}>
              <Text style={commonStyles.chipText}>API {API_BASE}</Text>
            </View>
            <Text style={apiHealth.status === 'error' ? commonStyles.errorText : apiHealth.status === 'success' ? commonStyles.successText : commonStyles.text}>
              {apiHealth.message}
            </Text>
          </Panel>
          <View style={commonStyles.panel}>
            <View style={styles.tabs}>
              <Tab active={!isCreate} label="Login" onPress={() => setAuthMode('login')} />
              <Tab active={isCreate} label="Create account" onPress={() => setAuthMode('create')} />
            </View>
            <FormField label={isCreate ? 'Username' : 'Email or username'} value={authForm.username} onChangeText={(value) => setAuthForm((current) => ({ ...current, username: value }))} />
            {isCreate ? <FormField label="Email" value={authForm.email} onChangeText={(value) => setAuthForm((current) => ({ ...current, email: value }))} /> : null}
            <FormField label="Password" value={authForm.password} onChangeText={(value) => setAuthForm((current) => ({ ...current, password: value }))} secureTextEntry />
            {isCreate ? <FormField label="Confirm password" value={authForm.confirmPassword} onChangeText={(value) => setAuthForm((current) => ({ ...current, confirmPassword: value }))} secureTextEntry /> : null}
            <Pressable style={[commonStyles.button, commonStyles.buttonPrimary]} onPress={submitAuth}>
              <Text style={commonStyles.buttonText}>{authSubmitting ? 'Working...' : isCreate ? 'Create account' : 'Sign in'}</Text>
            </Pressable>
            {authStatus ? <Text style={authStatus.type === 'error' ? commonStyles.errorText : commonStyles.successText}>{authStatus.message}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={commonStyles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={commonStyles.content}>
        <Panel title={activeTab === 'jobs-new' ? 'Create a new job' : activeTab === 'jobs' ? 'Job dashboard' : activeTab === 'clients' ? 'Client relationships' : 'Calendar overview'} subtitle="Workspace overview">
          <Text style={commonStyles.text}>Signed in as {session.user?.name || session.user?.email || 'Workspace user'}.</Text>
          <Text style={apiHealth.status === 'error' ? commonStyles.errorText : apiHealth.status === 'success' ? commonStyles.successText : commonStyles.text}>
            {apiHealth.message}
          </Text>
          <Pressable style={[commonStyles.button, commonStyles.buttonSecondary]} onPress={logout}>
            <Text style={commonStyles.buttonText}>Logout</Text>
          </Pressable>
        </Panel>
        <View style={commonStyles.panel}>
          <Text style={commonStyles.muted}>Navigation</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
            {!jobsLoading && !jobsError ? jobs.map((job) => <JobCard key={job.id} job={job} onPress={() => setSelectedJob(job)} />) : null}
          </>
        ) : null}

        {activeTab === 'jobs-new' ? (
          <View style={commonStyles.panel}>
            <Text style={commonStyles.sectionTitle}>Appointment details</Text>
            <FormField label="Client name" value={jobForm.name} onChangeText={(value) => setJobForm((current) => ({ ...current, name: value }))} error={jobErrors.name} />
            <FormField label="Phone" value={jobForm.phone} onChangeText={(value) => setJobForm((current) => ({ ...current, phone: value.replace(/\D/g, '') }))} error={jobErrors.phone} />
            <FormField label="Address" value={jobForm.address} onChangeText={(value) => setJobForm((current) => ({ ...current, address: value }))} error={jobErrors.address} />
            <FormField label="Job type" value={jobForm.jobType} onChangeText={(value) => setJobForm((current) => ({ ...current, jobType: value }))} error={jobErrors.jobType} />
            <FormField label="Date" value={jobForm.jobDate} onChangeText={(value) => setJobForm((current) => ({ ...current, jobDate: value }))} error={jobErrors.jobDate} placeholder="YYYY-MM-DD" />
            <FormField label="Payment" value={jobForm.payment} onChangeText={(value) => setJobForm((current) => ({ ...current, payment: value }))} error={jobErrors.payment} placeholder="0.00" />
            <FormField label="Comments" value={jobForm.comments} onChangeText={(value) => setJobForm((current) => ({ ...current, comments: value }))} error={jobErrors.comments} multiline />
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
                <Text style={commonStyles.heading3}>{client.name}</Text>
                <Text style={commonStyles.text}>{client.phone || '-'} | {client.address || '-'}</Text>
                <View style={commonStyles.chip}><Text style={commonStyles.chipText}>{client.jobs.length} jobs - {formatCurrency(client.totalPayments)}</Text></View>
                {client.jobs.map((job) => (
                  <Pressable key={job.id} style={styles.inlineCard} onPress={() => setSelectedJob(job)}>
                    <Text style={styles.inlineTitle}>{job.job_type}</Text>
                    <Text style={commonStyles.text}>{formatDate(job.job_date)}</Text>
                  </Pressable>
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
                  <Pressable key={job.id} style={styles.inlineCard} onPress={() => setSelectedJob(job)}>
                    <Text style={styles.inlineTitle}>{job.name}</Text>
                    <Text style={commonStyles.text}>{job.job_type} - {formatCurrency(job.payment)}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
      <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} onSave={saveJobUpdates} />
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

function JobCard({ job, onPress }) {
  return (
    <Pressable style={commonStyles.panel} onPress={onPress}>
      <View style={commonStyles.rowBetween}>
        <Text style={commonStyles.heading3}>{job.name}</Text>
        <View style={commonStyles.chip}><Text style={commonStyles.chipText}>{job.status}</Text></View>
      </View>
      <Text style={commonStyles.text}>{formatDate(job.job_date)}</Text>
      <Text style={commonStyles.text}>{job.job_type}</Text>
      <Text style={commonStyles.text}>{job.phone || '-'}</Text>
      <Text style={commonStyles.text}>{job.address || '-'}</Text>
      <Text style={commonStyles.text}>Payment: {formatCurrency(job.payment)}</Text>
      <Text style={commonStyles.text}>{job.comments || 'No notes yet'}</Text>
    </Pressable>
  )
}

function JobModal({ job, onClose, onSave }) {
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
      jobDate: String(job.job_date || '').slice(0, 10),
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
        <View style={styles.modalPanel}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={commonStyles.sectionTitle}>Edit job</Text>
            <Text style={commonStyles.text}>Update client details, status, payment, and notes from this mobile sheet.</Text>
            <FormField label="Client name" value={formState?.name || ''} onChangeText={(value) => setFormState((current) => ({ ...current, name: value }))} />
            <FormField label="Phone" value={formState?.phone || ''} onChangeText={(value) => setFormState((current) => ({ ...current, phone: value.replace(/\D/g, '') }))} />
            <FormField label="Address" value={formState?.address || ''} onChangeText={(value) => setFormState((current) => ({ ...current, address: value }))} />
            <FormField label="Job type" value={formState?.jobType || ''} onChangeText={(value) => setFormState((current) => ({ ...current, jobType: value }))} />
            <FormField label="Date" value={formState?.jobDate || ''} onChangeText={(value) => setFormState((current) => ({ ...current, jobDate: value }))} placeholder="YYYY-MM-DD" />
            <FormField label="Status" value={formState?.status || ''} onChangeText={(value) => setFormState((current) => ({ ...current, status: value }))} placeholder="Pending, In Progress, Completed, Cancelled" />
            <FormField label="Payment" value={formState?.payment || ''} onChangeText={(value) => setFormState((current) => ({ ...current, payment: value }))} placeholder="0.00" />
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
            <View style={commonStyles.chip}>
              <Text style={commonStyles.chipText}>Original date {formatDate(job.job_date)}</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
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
  multiline: { minHeight: 120 },
  inlineCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.card, padding: 14, gap: 6 },
  inlineTitle: { color: colors.heading, fontWeight: '700', fontSize: 16 },
  calendarControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.8)' },
  modalPanel: { maxHeight: '85%', backgroundColor: colors.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.border },
  modalContent: { padding: 20, gap: 14 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalAction: { flex: 1 }
})
