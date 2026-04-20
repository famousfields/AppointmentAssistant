import { useApi } from './apiContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useJobTypes from './useJobTypes'
import { buildJobTypeSuggestionSet } from './jobTypes'
import ClientSuggestions from './ClientSuggestions'
import {
  applyClientSuggestion,
  buildClients,
  formatPhonePreview,
  normalizePhoneDigits
} from './clientUtils'
import { parseDateValue } from './dateUtils'
import GoogleMapsLink from './GoogleMapsLink'
import JobTypeManager from './JobTypeManager'
import { MetricCard, SectionCard, StatusChip } from './productUi'

const EMPTY_FORM_DATA = {
  name: '',
  phone: '',
  address: '',
  jobType: '',
  jobDate: '',
  startTime: '',
  payment: '',
  comments: ''
}

const getDraftStorageKey = (userId) =>
  `appointment-assistant:job-draft:${userId ?? 'guest'}`

const PHONE_EXAMPLE = '(555) 123-4567'

const formatSchedulePreview = (jobDate, startTime) => {
  if (!jobDate && !startTime) return 'No visit time selected yet'

  const date = parseDateValue(jobDate)
  const dateLabel = date
    ? date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    : 'Date not set'

  if (!startTime) return `${dateLabel} | Time not set`

  const [hoursText = '0', minutesText = '00'] = String(startTime).split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return `${dateLabel} | Time not set`

  const start = new Date(2000, 0, 1, hours, minutes)
  const end = new Date(2000, 0, 1, hours + 1, minutes)

  return `${dateLabel} | ${start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })} - ${end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })}`
}

export default function JobForm({ currentUser }) {
  const [formData, setFormData] = useState(EMPTY_FORM_DATA)
  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')
  const [clientJobs, setClientJobs] = useState([])
  const [suggestionField, setSuggestionField] = useState(null)
  const navigate = useNavigate()
  const redirectTimer = useRef(null)
  const isInitialMount = useRef(true)
  const { fetchWithAuth, subscriptionSummary, refreshSubscription } = useApi()
  const clients = useMemo(() => buildClients(clientJobs), [clientJobs])
  const {
    jobTypes,
    loading: jobTypesLoading,
    error: jobTypesError,
    refreshJobTypes,
    createJobType,
    updateJobType,
    deleteJobType
  } = useJobTypes(currentUser)
  const jobTypeSuggestions = useMemo(() => buildJobTypeSuggestionSet(jobTypes), [jobTypes])
  const canManageJobTypes = subscriptionSummary?.entitlements?.canManageJobTypes ?? true
  const creationBlocked = subscriptionSummary?.entitlements?.creationBlocked ?? false
  const jobTypePanelError =
    jobTypesError ||
    (!canManageJobTypes && currentUser
      ? 'Custom job types and color management unlock on Starter and above.'
      : '')

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        if (!value || value.trim().length < 2) return 'Enter a valid name (min 2 chars)'
        return ''
      case 'phone': {
        const digits = (value || '').replace(/\D/g, '')
        if (digits.length < 7 || digits.length > 15) return 'Enter a valid phone (7-15 digits)'
        return ''
      }
      case 'address':
        if (!value || value.trim().length < 5) return 'Enter a valid address (min 5 chars)'
        return ''
      case 'jobType':
        if (!value || value.trim().length === 0) return 'Job type is required'
        return ''
      case 'jobDate':
        if (!value) return 'Date is required'
        if (!parseDateValue(value)) return 'Invalid date'
        return ''
      case 'startTime':
        if (!value) return 'Start time is required'
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) return 'Use HH:MM in 24-hour time'
        return ''
      case 'comments':
        if (value && value.length > 500) return 'Comments max 500 chars'
        return ''
      case 'payment':
        if (!value) return ''
        if (!/^\d+(\.\d{0,2})?$/.test(value)) return 'Payment must be a valid amount'
        if (Number(value) < 0) return 'Payment cannot be negative'
        return ''
      default:
        return ''
    }
  }

  const handleChange = (event) => {
    let { name, value } = event.target

    if (name === 'phone') {
      value = normalizePhoneDigits(value)
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
  }

  const validateAll = () => {
    const nextErrors = {}
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key])
      if (error) nextErrors[key] = error
    })
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const applyExistingClient = (client) => {
    setFormData((prev) => ({
      ...prev,
      ...applyClientSuggestion(client)
    }))
    setErrors((prev) => ({
      ...prev,
      name: '',
      phone: '',
      address: ''
    }))
    setSuggestionField(null)
  }

  const dismissSuggestionsAsNewClient = () => {
    setSuggestionField(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateAll()) return
    setSuccessMessage('')

    try {
      const response = await fetchWithAuth('/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          payment: formData.payment === '' ? 0 : Number(formData.payment)
        })
      })

      const data = await response.json()
      if (response.ok) {
        window.localStorage.removeItem(getDraftStorageKey(currentUser?.id))
        setErrors((prev) => ({ ...prev, submit: '' }))
        setSuccessMessage('Job created! Redirecting to Jobs...')
        setFormData(EMPTY_FORM_DATA)
        setSuggestionField(null)
        await refreshJobTypes()
        await refreshSubscription()
        redirectTimer.current = setTimeout(() => {
          navigate('/jobs')
        }, 1000)
      } else {
        const errorMessage =
          data.errors?.[0]?.msg || data.error || data.message || 'Unable to create job'
        setErrors((prev) => ({ ...prev, submit: errorMessage }))
        setSuccessMessage('')
        await refreshSubscription()
      }
    } catch (error) {
      console.error('Network error:', error)
      setErrors((prev) => ({ ...prev, submit: 'Network error. Check backend.' }))
      setSuccessMessage('')
    }
  }

  useEffect(() => {
    if (!currentUser) {
      setClientJobs([])
      return
    }

    let active = true

    const loadClients = async () => {
      try {
        const response = await fetchWithAuth('/jobs')
        if (!response.ok) throw new Error('Unable to load client suggestions')
        const data = await response.json()
        if (active) setClientJobs(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Failed loading client suggestions:', error)
        if (active) setClientJobs([])
      }
    }

    loadClients()

    return () => {
      active = false
    }
  }, [currentUser, fetchWithAuth])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedDraft = window.localStorage.getItem(getDraftStorageKey(currentUser?.id))
    if (!savedDraft) {
      setFormData(EMPTY_FORM_DATA)
      setErrors({})
      setSuccessMessage('')
      isInitialMount.current = false
      return
    }

    try {
      const parsedDraft = JSON.parse(savedDraft)
      setFormData({
        ...EMPTY_FORM_DATA,
        ...parsedDraft
      })
    } catch (error) {
      console.error('Failed to parse saved job draft:', error)
      window.localStorage.removeItem(getDraftStorageKey(currentUser?.id))
      setFormData(EMPTY_FORM_DATA)
    }

    setErrors({})
    setSuccessMessage('')
    isInitialMount.current = false
  }, [currentUser?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isInitialMount.current) return

    const hasDraftContent = Object.values(formData).some((value) =>
      String(value ?? '').trim().length > 0
    )

    if (!hasDraftContent) {
      window.localStorage.removeItem(getDraftStorageKey(currentUser?.id))
      return
    }

    window.localStorage.setItem(
      getDraftStorageKey(currentUser?.id),
      JSON.stringify(formData)
    )
  }, [formData, currentUser?.id])

  useEffect(() => () => {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current)
    }
  }, [])

  const hasErrors = Object.values(errors).some(Boolean)
  const clientLabel = formData.name || 'New client'
  const scheduleLabel = formatSchedulePreview(formData.jobDate, formData.startTime)
  const paymentLabel = formData.payment ? `$${Number(formData.payment).toFixed(2)}` : 'Not priced yet'
  const noteSummary = formData.comments.trim() ? `${formData.comments.trim().length}/500 chars` : 'No internal notes yet'
  const knownClientCount = clients.length
  const draftHasContent = Object.values(formData).some((value) => String(value || '').trim())

  return (
    <div className="job-form-layout">
      <div className="job-form-shell">
        <div className="job-form-main">
          <SectionCard
            eyebrow="New Work Order"
            title="Create a job your team can act on immediately"
            description="Start with the client, lock in the visit, and leave the next technician with the exact context they need."
            action={currentUser ? <StatusChip tone="scheduled">Ready to schedule</StatusChip> : null}
            className="job-form-hero"
          >
            {currentUser && subscriptionSummary ? (
              <div className={`subscription-notice${creationBlocked ? ' subscription-notice--alert' : ''}`}>
                <div>
                  <strong>{subscriptionSummary.planName} plan</strong>
                  <p>
                    {subscriptionSummary.usage.monthlyClientLimit === null
                      ? 'Unlimited clients and jobs are active for this workspace.'
                      : `${subscriptionSummary.usage.monthlyClientCreations}/${subscriptionSummary.usage.monthlyClientLimit} clients and ${subscriptionSummary.usage.monthlyJobCreations}/${subscriptionSummary.usage.monthlyJobLimit} jobs used this month.`}
                  </p>
                </div>
                <button
                  type="button"
                  className="comments-button comments-button--ghost"
                  onClick={() => navigate('/billing')}
                >
                  View billing
                </button>
              </div>
            ) : null}

            {!currentUser ? (
              <div className="form-error-message">
                Please log in before creating a job.
              </div>
            ) : null}
          </SectionCard>

          <form onSubmit={handleSubmit} noValidate className="job-form job-form--workflow">
            <SectionCard
              eyebrow="Step 1"
              title="Client and location"
              description="Find an existing client when possible, or keep typing to create a new one."
              compact
            >
              <div className="form-grid form-grid--two">
                <div className="form-group">
                  <label htmlFor="name">Client name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    onChange={(event) => {
                      handleChange(event)
                      setSuggestionField('name')
                    }}
                    value={formData.name}
                    placeholder="Jane Smith"
                  />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="tel"
                    required
                    onChange={(event) => {
                      handleChange(event)
                      setSuggestionField('phone')
                    }}
                    value={formData.phone}
                    maxLength={15}
                    placeholder={PHONE_EXAMPLE}
                  />
                  <div className="form-hint">Digits only. Preview: {formatPhonePreview(formData.phone)}</div>
                  {errors.phone && <div className="form-error">{errors.phone}</div>}
                </div>
              </div>

              <ClientSuggestions
                clients={clients}
                query={suggestionField === 'phone' ? formData.phone : formData.name}
                field={suggestionField === 'phone' ? 'phone' : 'name'}
                visible={suggestionField === 'name' || suggestionField === 'phone'}
                onSelect={applyExistingClient}
                onCreateNew={dismissSuggestionsAsNewClient}
                createLabel={`Create new client${formData.name ? `: ${formData.name}` : ''}`}
              />

              <div className="form-group">
                <label htmlFor="address">Service address</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  autoComplete="street-address"
                  required
                  onChange={(event) => {
                    handleChange(event)
                    setSuggestionField('address')
                  }}
                  value={formData.address}
                  placeholder="123 Main St, Springfield, IL 62704"
                />
                <div className="form-inline-actions">
                  <GoogleMapsLink address={formData.address} />
                  <span className="form-hint">
                    Include street, city, and unit details so the crew can find the visit quickly.
                  </span>
                </div>
                {errors.address && <div className="form-error">{errors.address}</div>}
              </div>

              <ClientSuggestions
                clients={clients}
                query={formData.address}
                field="address"
                visible={suggestionField === 'address'}
                onSelect={applyExistingClient}
                onCreateNew={dismissSuggestionsAsNewClient}
                createLabel="Use this as a new address"
              />
            </SectionCard>

            <SectionCard
              eyebrow="Step 2"
              title="Schedule and scope"
              description="Give the office and field team the scheduling context before they need to make a decision."
              compact
            >
              <div className="form-grid form-grid--two">
                <div className="form-group">
                  <label htmlFor="jobType">Job type</label>
                  <input
                    id="jobType"
                    name="jobType"
                    type="text"
                    list="job-type-options"
                    required
                    onChange={(event) => {
                      handleChange(event)
                      setSuggestionField(null)
                    }}
                    value={formData.jobType}
                    placeholder="Mulch installation"
                  />
                  <datalist id="job-type-options">
                    {jobTypeSuggestions.map((jobType) => (
                      <option key={jobType} value={jobType} />
                    ))}
                  </datalist>
                  <div className="form-hint">
                    Use a business-specific job label. Saved job types make the calendar faster to scan.
                  </div>
                  {errors.jobType && <div className="form-error">{errors.jobType}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="jobDate">Date</label>
                  <input
                    id="jobDate"
                    name="jobDate"
                    type="date"
                    required
                    onChange={(event) => {
                      handleChange(event)
                      setSuggestionField(null)
                    }}
                    value={formData.jobDate}
                  />
                  {errors.jobDate && <div className="form-error">{errors.jobDate}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="startTime">Start time</label>
                  <input
                    id="startTime"
                    name="startTime"
                    type="time"
                    required
                    onChange={(event) => {
                      handleChange(event)
                      setSuggestionField(null)
                    }}
                    value={formData.startTime}
                  />
                  <div className="form-hint">Each job reserves a one-hour timeslot starting at this time.</div>
                  {errors.startTime && <div className="form-error">{errors.startTime}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="payment">Quoted amount</label>
                  <input
                    id="payment"
                    name="payment"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    onChange={(event) => {
                      handleChange(event)
                      setSuggestionField(null)
                    }}
                    value={formData.payment}
                    placeholder="0.00"
                  />
                  <div className="form-hint">Optional now, useful later for invoicing and payment follow-up.</div>
                  {errors.payment && <div className="form-error">{errors.payment}</div>}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Step 3"
              title="Internal notes"
              description="Leave the details that reduce callbacks, confusion, and missed arrivals."
              compact
            >
              <div className="form-group">
                <label htmlFor="comments">Dispatch notes</label>
                <textarea
                  id="comments"
                  name="comments"
                  onChange={(event) => {
                    handleChange(event)
                    setSuggestionField(null)
                  }}
                  value={formData.comments}
                  placeholder="Gate code 2468. Park in driveway. Customer prefers afternoon arrival."
                />
                <div className="form-hint">
                  Add gate codes, scope reminders, arrival notes, or anything the office should not have to repeat.
                </div>
                {errors.comments && <div className="form-error">{errors.comments}</div>}
              </div>
            </SectionCard>

            {errors.submit && <div className="form-error-message">{errors.submit}</div>}
            {successMessage && <div className="form-success-message">{successMessage}</div>}

            <div className="form-sticky-footer">
              <div className="form-sticky-footer__copy">
                <strong>{draftHasContent ? 'Draft saved automatically' : 'Start filling in the work order'}</strong>
                <span>
                  {creationBlocked
                    ? 'Upgrade or wait for your usage reset to create another job.'
                    : 'The job will appear in your operations dashboard as soon as you save it.'}
                </span>
              </div>
              <button
                type="submit"
                disabled={hasErrors || !currentUser || creationBlocked}
                className="form-submit-button"
              >
                {creationBlocked ? 'Upgrade or wait for reset' : 'Create work order'}
              </button>
            </div>
          </form>
        </div>

        <aside className="job-form-sidebar">
          <SectionCard
            eyebrow="Dispatch Summary"
            title={clientLabel}
            description="Review what the office and field crew will understand from this job before you save it."
          >
            <div className="metric-card-grid">
              <MetricCard label="Known clients" value={knownClientCount} helper="Available for quick lookup" />
              <MetricCard label="Schedule" value={formData.jobDate ? 'Scheduled' : 'Needs date'} helper={scheduleLabel} tone={formData.jobDate ? 'accent' : 'default'} />
            </div>

            <div className="job-preview-stack">
              <div className="job-preview-card">
                <span className="job-preview-card__label">Visit</span>
                <strong>{scheduleLabel}</strong>
              </div>
              <div className="job-preview-card">
                <span className="job-preview-card__label">Scope</span>
                <strong>{formData.jobType || 'Job type not set yet'}</strong>
              </div>
              <div className="job-preview-card">
                <span className="job-preview-card__label">Billing readiness</span>
                <strong>{paymentLabel}</strong>
              </div>
              <div className="job-preview-card">
                <span className="job-preview-card__label">Notes</span>
                <strong>{noteSummary}</strong>
              </div>
            </div>
          </SectionCard>

          <JobTypeManager
            jobTypes={jobTypes}
            loading={jobTypesLoading}
            error={jobTypePanelError}
            disabled={!currentUser || !canManageJobTypes}
            disabledMessage={
              !currentUser
                ? 'Log in to manage job types.'
                : 'Upgrade to Starter or above to create custom job types and colors.'
            }
            onCreate={createJobType}
            onUpdate={updateJobType}
            onDelete={deleteJobType}
          />
        </aside>
      </div>
    </div>
  )
}
