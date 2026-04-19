import { useApi } from './apiContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useJobTypes from './useJobTypes'
import { buildJobTypeSuggestionSet } from './jobTypes'
import ClientSuggestions from './ClientSuggestions'
import { applyClientSuggestion, buildClients, formatPhonePreview, normalizePhoneDigits } from './clientUtils'
import { parseDateValue } from './dateUtils'
import GoogleMapsLink from './GoogleMapsLink'
import JobTypeManager from './JobTypeManager'

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
      case 'jobDate': {
        if (!value) return 'Date is required'
        if (!parseDateValue(value)) return 'Invalid date'
        return ''
      }
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

  const handleChange = (e) => {
    let { name, value } = e.target

    if (name === 'phone') {
      value = normalizePhoneDigits(value)
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
  }

  const validateAll = () => {
    const newErrors = {}
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key])
      if (error) newErrors[key] = error
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateAll()) return
    setSuccessMessage('')

    try {
      const res = await fetchWithAuth('/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          payment: formData.payment === '' ? 0 : Number(formData.payment)
        })
      })

      const data = await res.json()
      if (res.ok) {
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
    } catch (err) {
      console.error('Network error:', err)
      setErrors((prev) => ({ ...prev, submit: 'Network error. Check backend.' }))
      setSuccessMessage('')
    }
  }

  const hasErrors = Object.values(errors).some(Boolean)

  useEffect(() => {
    if (!currentUser) {
      setClientJobs([])
      return
    }

    let active = true

    const loadClients = async () => {
      try {
        const res = await fetchWithAuth('/jobs')
        if (!res.ok) throw new Error('Unable to load client suggestions')
        const data = await res.json()
        if (active) setClientJobs(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed loading client suggestions:', err)
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
    } catch (err) {
      console.error('Failed to parse saved job draft:', err)
      window.localStorage.removeItem(getDraftStorageKey(currentUser?.id))
      setFormData(EMPTY_FORM_DATA)
    }

    setErrors({})
    setSuccessMessage('')
    isInitialMount.current = false
  }, [currentUser?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Skip saving on initial mount to avoid wiping the loaded draft
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

  useEffect(() => {
    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current)
      }
    }
  }, [])

  return (
    <div className="job-form-layout">
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

      <form onSubmit={handleSubmit} noValidate className="job-form">
        <div>
          <h3>Appointment details</h3>
          <p className="login-subtitle">
            Capture the client info, scheduled date, and any notes your team should see before the visit.
          </p>
        </div>

        {!currentUser && (
          <div className="form-error-message">
            Please log in before creating a job.
          </div>
        )}

        {currentUser && subscriptionSummary && (
          <div className={`subscription-notice${creationBlocked ? ' subscription-notice--alert' : ''}`}>
            <strong>{subscriptionSummary.planName} plan</strong>
            <span>
              {subscriptionSummary.usage.monthlyClientLimit === null
                ? 'Unlimited clients and jobs are active for this workspace.'
                : `${subscriptionSummary.usage.monthlyClientCreations}/${subscriptionSummary.usage.monthlyClientLimit} clients and ${subscriptionSummary.usage.monthlyJobCreations}/${subscriptionSummary.usage.monthlyJobLimit} jobs used this month.`}
            </span>
            <button type="button" className="comments-button comments-button--ghost" onClick={() => navigate('/billing')}>
              View billing
            </button>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="name">Client name</label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            onChange={(e) => {
              handleChange(e)
              setSuggestionField('name')
            }}
            value={formData.name}
            placeholder="Jane Smith"
          />
          {errors.name && <div className="form-error">{errors.name}</div>}
        </div>
        <ClientSuggestions
          clients={clients}
          query={formData.name}
          field="name"
          visible={suggestionField === 'name'}
          onSelect={(client) => {
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
          }}
        />

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
          onChange={(e) => {
            handleChange(e)
            setSuggestionField('phone')
          }}
          value={formData.phone}
          maxLength={15}
          placeholder={PHONE_EXAMPLE}
        />
        <div className="form-hint">Enter digits only. Preview: {formatPhonePreview(formData.phone)}</div>
        {errors.phone && <div className="form-error">{errors.phone}</div>}
      </div>
      <ClientSuggestions
        clients={clients}
        query={formData.phone}
        field="phone"
        visible={suggestionField === 'phone'}
        onSelect={(client) => {
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
        }}
      />

      <div className="form-group">
        <label htmlFor="address">Address</label>
        <input
          id="address"
          name="address"
          type="text"
          autoComplete="street-address"
          required
          onChange={(e) => {
            handleChange(e)
            setSuggestionField('address')
          }}
          value={formData.address}
          placeholder="123 Main St, Springfield, IL 62704"
        />
        <GoogleMapsLink address={formData.address} />
        <div className="form-hint">Include street, city, and any unit details so the crew can find the appointment quickly.</div>
        {errors.address && <div className="form-error">{errors.address}</div>}
      </div>
      <ClientSuggestions
        clients={clients}
        query={formData.address}
        field="address"
        visible={suggestionField === 'address'}
        onSelect={(client) => {
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
        }}
      />

        <div className="form-group">
          <label htmlFor="jobType">Job type</label>
          <input
            id="jobType"
            name="jobType"
            type="text"
            list="job-type-options"
            required
            onChange={(e) => {
              handleChange(e)
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
          <div className="form-hint">Type a business-specific job label. Save the color in the Job Types panel so the calendar stays easy to scan.</div>
          {errors.jobType && <div className="form-error">{errors.jobType}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="jobDate">Date</label>
          <input
            id="jobDate"
            name="jobDate"
            type="date"
            required
            onChange={(e) => {
              handleChange(e)
              setSuggestionField(null)
            }}
            value={formData.jobDate}
            placeholder="YYYY-MM-DD"
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
            onChange={(e) => {
              handleChange(e)
              setSuggestionField(null)
            }}
            value={formData.startTime}
          />
          <div className="form-hint">Each job reserves a one-hour timeslot starting at this time.</div>
          {errors.startTime && <div className="form-error">{errors.startTime}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="payment">Payment</label>
          <input
            id="payment"
            name="payment"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            onChange={(e) => {
              handleChange(e)
              setSuggestionField(null)
            }}
            value={formData.payment}
            placeholder="0.00"
          />
          {errors.payment && <div className="form-error">{errors.payment}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="comments">Comments</label>
          <textarea
            id="comments"
            name="comments"
            onChange={(e) => {
              handleChange(e)
              setSuggestionField(null)
            }}
            value={formData.comments}
            placeholder="Gate code 2468. Park in driveway. Customer prefers afternoon arrival."
          ></textarea>
          <div className="form-hint">Add gate codes, parking notes, scope details, or anything the team should know before arrival.</div>
          {errors.comments && <div className="form-error">{errors.comments}</div>}
        </div>

        {errors.submit && <div className="form-error-message">{errors.submit}</div>}
        {successMessage && <div className="form-success-message">{successMessage}</div>}

        <button
          type="submit"
          disabled={hasErrors || !currentUser || creationBlocked}
          className="form-submit-button"
        >
          {creationBlocked ? 'Upgrade or wait for reset' : 'Save appointment'}
        </button>
      </form>
    </div>
  )
}
