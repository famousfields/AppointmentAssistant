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
import { FlowStepper, SectionCard, StatusChip } from './productUi'
import { APP_PATHS } from './appInfo'

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

const PHONE_EXAMPLE = '(555) 123-4567'

const FORM_STEPS = [
  {
    key: 'client',
    title: 'Client',
    description: 'Choose or create the customer record'
  },
  {
    key: 'schedule',
    title: 'Schedule',
    description: 'Define the work and lock in the timeslot'
  },
  {
    key: 'review',
    title: 'Review',
    description: 'Add notes and create the work order'
  }
]

const getDraftStorageKey = (userId) =>
  `appointment-assistant:job-draft:${userId ?? 'guest'}`

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

function GuidedField({
  id,
  label,
  hint,
  error,
  icon,
  children,
  status = 'default'
}) {
  return (
    <div className={`guided-field guided-field--${status}${error ? ' guided-field--error' : ''}`}>
      <div className="guided-field__header">
        <label htmlFor={id}>{label}</label>
        {hint ? <span className="guided-field__hint">{hint}</span> : null}
      </div>
      <div className="guided-field__body">
        {icon ? (
          <span className="guided-field__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {children}
      </div>
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  )
}

function ReviewPanel({ label, value, tone = 'default' }) {
  return (
    <div className={`review-panel review-panel--${tone}`}>
      <span className="review-panel__label">{label}</span>
      <strong className="review-panel__value">{value}</strong>
    </div>
  )
}

export default function JobForm({ currentUser }) {
  const [formData, setFormData] = useState(EMPTY_FORM_DATA)
  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')
  const [clientJobs, setClientJobs] = useState([])
  const [suggestionField, setSuggestionField] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedClientName, setSelectedClientName] = useState('')
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

  const updateField = (name, rawValue, options = {}) => {
    const value = name === 'phone' ? normalizePhoneDigits(rawValue) : rawValue

    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))

    if (options.suggestionField !== undefined) {
      setSuggestionField(options.suggestionField)
    }

    if (['name', 'phone', 'address'].includes(name) && selectedClientName) {
      setSelectedClientName('')
    }
  }

  const validateStep = (stepIndex) => {
    const fieldsByStep = [
      ['name', 'phone', 'address'],
      ['jobType', 'jobDate', 'startTime', 'payment'],
      ['comments']
    ]

    const nextErrors = {}
    fieldsByStep[stepIndex].forEach((field) => {
      const error = validateField(field, formData[field])
      if (error) nextErrors[field] = error
    })

    setErrors((prev) => ({ ...prev, ...nextErrors }))
    return Object.keys(nextErrors).length === 0
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

  const handleNextStep = () => {
    if (!validateStep(currentStep)) return
    setCurrentStep((prev) => Math.min(prev + 1, FORM_STEPS.length - 1))
  }

  const handleStepSelect = (stepIndex) => {
    if (stepIndex <= currentStep) {
      setCurrentStep(stepIndex)
      return
    }

    if (validateStep(currentStep)) {
      setCurrentStep(stepIndex)
    }
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
    setSelectedClientName(client.name || 'Existing client')
  }

  const dismissSuggestionsAsNewClient = () => {
    setSuggestionField(null)
    setSelectedClientName('')
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
        setSuccessMessage('Job created! Redirecting to Calendar...')
        setFormData(EMPTY_FORM_DATA)
        setSuggestionField(null)
        setCurrentStep(0)
        setSelectedClientName('')
        await refreshJobTypes()
        await refreshSubscription()
        redirectTimer.current = setTimeout(() => {
          navigate(APP_PATHS.dashboard)
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
  const clientLabel = formData.name || selectedClientName || 'New client'
  const scheduleLabel = formatSchedulePreview(formData.jobDate, formData.startTime)
  const paymentLabel = formData.payment ? `$${Number(formData.payment).toFixed(2)}` : 'Not priced yet'
  const noteSummary = formData.comments.trim() ? `${formData.comments.trim().length}/500 chars` : 'No internal notes yet'
  const stepDescriptions = [
    selectedClientName ? `Using ${selectedClientName}` : 'Start by selecting or creating the client record.',
    scheduleLabel,
    creationBlocked ? 'Billing limit reached for this workspace.' : 'Review the job before you create it.'
  ]

  return (
    <div className="job-form-layout">
      <div className="job-form-shell">
        <div className="job-form-main">
          <SectionCard
            eyebrow="New Work Order"
            title="Create a job your team can act on immediately"
            description="This flow guides the office from customer details to a scheduled, ready-to-dispatch work order."
            action={currentUser ? <StatusChip tone="scheduled">Primary workflow</StatusChip> : null}
            className="job-form-hero job-form-hero--guided"
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
                  onClick={() => navigate(APP_PATHS.billing)}
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
            <SectionCard compact className="job-flow-shell">
              <FlowStepper
                steps={FORM_STEPS.map((step, index) => ({
                  ...step,
                  description: stepDescriptions[index]
                }))}
                currentStep={currentStep}
                onStepSelect={handleStepSelect}
              />

              <div className="job-step-stage">
                <section className={`job-step-panel${currentStep === 0 ? ' job-step-panel--active' : ''}`}>
                  <SectionCard
                    eyebrow="Step 1"
                    title="Client Info"
                    description="Confirm who the work is for before the office commits the visit."
                    compact
                    className="job-step-card"
                  >
                    {selectedClientName ? (
                      <div className="selection-banner">
                        <span className="selection-banner__label">Existing client selected</span>
                        <strong>{selectedClientName}</strong>
                      </div>
                    ) : null}

                    <div className="form-grid form-grid--two">
                      <GuidedField
                        id="name"
                        label="Client name"
                        hint="Search or create"
                        icon="CL"
                        error={errors.name}
                        status={selectedClientName ? 'selected' : 'default'}
                      >
                        <input
                          id="name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          required
                          className="guided-input"
                          onChange={(event) => updateField('name', event.target.value, { suggestionField: 'name' })}
                          value={formData.name}
                          placeholder="Jane Smith"
                        />
                      </GuidedField>

                      <GuidedField
                        id="phone"
                        label="Phone"
                        hint={`Preview ${formatPhonePreview(formData.phone)}`}
                        icon="PH"
                        error={errors.phone}
                      >
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="tel"
                          required
                          className="guided-input"
                          onChange={(event) => updateField('phone', event.target.value, { suggestionField: 'phone' })}
                          value={formData.phone}
                          maxLength={15}
                          placeholder={PHONE_EXAMPLE}
                        />
                      </GuidedField>
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

                    <GuidedField
                      id="address"
                      label="Service address"
                      hint="Route-ready"
                      icon="AD"
                      error={errors.address}
                    >
                      <input
                        id="address"
                        name="address"
                        type="text"
                        autoComplete="street-address"
                        required
                        className="guided-input"
                        onChange={(event) => updateField('address', event.target.value, { suggestionField: 'address' })}
                        value={formData.address}
                        placeholder="123 Main St, Springfield, IL 62704"
                      />
                    </GuidedField>

                    <div className="form-inline-actions">
                      <GoogleMapsLink address={formData.address} />
                      <span className="form-hint">
                        Include street, city, and unit details so the crew can find the visit quickly.
                      </span>
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
                </section>

                <section className={`job-step-panel${currentStep === 1 ? ' job-step-panel--active' : ''}`}>
                  <SectionCard
                    eyebrow="Step 2"
                    title="Job Details And Scheduling"
                    description="Define the scope, then give dispatch a clear arrival window."
                    compact
                    className="job-step-card"
                  >
                    <div className="form-grid form-grid--two">
                      <GuidedField
                        id="jobType"
                        label="Job type"
                        hint="Business label"
                        icon="JT"
                        error={errors.jobType}
                      >
                        <input
                          id="jobType"
                          name="jobType"
                          type="text"
                          list="job-type-options"
                          required
                          className="guided-input"
                          onChange={(event) => updateField('jobType', event.target.value, { suggestionField: null })}
                          value={formData.jobType}
                          placeholder="Mulch installation"
                        />
                        <datalist id="job-type-options">
                          {jobTypeSuggestions.map((jobType) => (
                            <option key={jobType} value={jobType} />
                          ))}
                        </datalist>
                      </GuidedField>

                      <GuidedField
                        id="payment"
                        label="Quoted amount"
                        hint="Optional now"
                        icon="$"
                        error={errors.payment}
                      >
                        <input
                          id="payment"
                          name="payment"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="guided-input"
                          onChange={(event) => updateField('payment', event.target.value, { suggestionField: null })}
                          value={formData.payment}
                          placeholder="0.00"
                        />
                      </GuidedField>

                      <GuidedField
                        id="jobDate"
                        label="Date"
                        hint="Required"
                        icon="DT"
                        error={errors.jobDate}
                      >
                        <input
                          id="jobDate"
                          name="jobDate"
                          type="date"
                          required
                          className="guided-input"
                          onChange={(event) => updateField('jobDate', event.target.value, { suggestionField: null })}
                          value={formData.jobDate}
                        />
                      </GuidedField>

                      <GuidedField
                        id="startTime"
                        label="Start time"
                        hint="One-hour slot"
                        icon="TM"
                        error={errors.startTime}
                      >
                        <input
                          id="startTime"
                          name="startTime"
                          type="time"
                          required
                          className="guided-input"
                          onChange={(event) => updateField('startTime', event.target.value, { suggestionField: null })}
                          value={formData.startTime}
                        />
                      </GuidedField>
                    </div>

                    <div className="schedule-preview-banner">
                      <span className="schedule-preview-banner__label">Dispatch preview</span>
                      <strong>{scheduleLabel}</strong>
                      <span>The calendar will reserve a one-hour timeslot starting here.</span>
                    </div>
                  </SectionCard>
                </section>

                <section className={`job-step-panel${currentStep === 2 ? ' job-step-panel--active' : ''}`}>
                  <SectionCard
                    eyebrow="Step 3"
                    title="Review And Create"
                    description="Capture internal notes, sanity-check the job, and create it with one clear action."
                    compact
                    className="job-step-card"
                  >
                    <GuidedField
                      id="comments"
                      label="Dispatch notes"
                      hint={`${formData.comments.length}/500`}
                      icon="NT"
                      error={errors.comments}
                    >
                      <textarea
                        id="comments"
                        name="comments"
                        className="guided-input guided-input--textarea"
                        onChange={(event) => updateField('comments', event.target.value, { suggestionField: null })}
                        value={formData.comments}
                        placeholder="Gate code 2468. Park in driveway. Customer prefers afternoon arrival."
                      />
                    </GuidedField>

                    <div className="review-grid">
                      <ReviewPanel label="Client" value={clientLabel} />
                      <ReviewPanel label="Visit" value={scheduleLabel} tone="accent" />
                      <ReviewPanel label="Scope" value={formData.jobType || 'Job type not set yet'} />
                      <ReviewPanel label="Revenue" value={paymentLabel} tone="success" />
                      <ReviewPanel label="Notes" value={noteSummary} />
                    </div>

                    <div className="cta-review-panel">
                      <div className="cta-review-panel__copy">
                        <span className="cta-review-panel__eyebrow">Primary Action</span>
                        <h4>Create Job</h4>
                        <p>
                          {creationBlocked
                            ? 'Upgrade or wait for your usage reset to create another job.'
                            : 'This creates the work order instantly and makes it available across jobs, clients, and calendar.'}
                        </p>
                      </div>

                      {errors.submit && <div className="form-error-message">{errors.submit}</div>}
                      {successMessage && <div className="form-success-message">{successMessage}</div>}

                      <button
                        type="submit"
                        disabled={hasErrors || !currentUser || creationBlocked}
                        className="form-submit-button form-submit-button--hero"
                      >
                        {creationBlocked ? 'Upgrade or wait for reset' : 'Create Job'}
                      </button>
                    </div>
                  </SectionCard>
                </section>
              </div>

              <div className="step-actions">
                <button
                  type="button"
                  className="comments-modal-button comments-modal-button--ghost step-actions__button"
                  onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                  disabled={currentStep === 0}
                >
                  Back
                </button>

                {currentStep < FORM_STEPS.length - 1 ? (
                  <button
                    type="button"
                    className="comments-modal-button comments-modal-button--primary step-actions__button"
                    onClick={handleNextStep}
                  >
                    Continue to {FORM_STEPS[currentStep + 1].title}
                  </button>
                ) : (
                  <span className="step-actions__completion">Ready to create</span>
                )}
              </div>
            </SectionCard>
          </form>
        </div>

        <aside className="job-form-sidebar">
          <SectionCard
            eyebrow="Live Summary"
            title={clientLabel}
            description="A quick read on what your team will see as you build the job."
            className="job-form-sidebar-card"
          >
            <div className="job-preview-stack">
              <div className="job-preview-card">
                <span className="job-preview-card__label">Selected Client</span>
                <strong>{selectedClientName || 'New client entry'}</strong>
              </div>
              <div className="job-preview-card">
                <span className="job-preview-card__label">Visit Window</span>
                <strong>{scheduleLabel}</strong>
              </div>
              <div className="job-preview-card">
                <span className="job-preview-card__label">Billing Readiness</span>
                <strong>{paymentLabel}</strong>
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
                : 'Purchase the Starter plan or above to create custom job types and colors.'
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
