import { useApi } from './apiContext'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { JOB_TYPE_OPTIONS } from './jobTypes'

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

const formatPhonePreview = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 15)

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

export default function JobForm({ currentUser }) {
  const [formData, setFormData] = useState(EMPTY_FORM_DATA)
  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()
  const redirectTimer = useRef(null)
  const isInitialMount = useRef(true)
  const { fetchWithAuth } = useApi()

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
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) return 'Invalid date'
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
      value = value.replace(/\D/g, '').slice(0, 15)
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
        redirectTimer.current = setTimeout(() => {
          navigate('/jobs')
        }, 1000)
      } else {
        const errorMessage =
          data.errors?.[0]?.msg || data.error || data.message || 'Unable to create job'
        setErrors((prev) => ({ ...prev, submit: errorMessage }))
        setSuccessMessage('')
      }
    } catch (err) {
      console.error('Network error:', err)
      setErrors((prev) => ({ ...prev, submit: 'Network error. Check backend.' }))
      setSuccessMessage('')
    }
  }

  const hasErrors = Object.values(errors).some(Boolean)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedDraft = window.localStorage.getItem(getDraftStorageKey(currentUser?.id))
    if (!savedDraft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

      <div className="form-group">
        <label htmlFor="name">Client name</label>
        <input id="name" name="name" type="text" required onChange={handleChange} value={formData.name} placeholder="Jane Smith" />
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
          onChange={handleChange}
          value={formData.phone}
          maxLength={15}
          placeholder={PHONE_EXAMPLE}
        />
        <div className="form-hint">Enter digits only. Preview: {formatPhonePreview(formData.phone)}</div>
        {errors.phone && <div className="form-error">{errors.phone}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="address">Address</label>
        <input id="address" name="address" type="text" required onChange={handleChange} value={formData.address} placeholder="123 Main St, Springfield, IL 62704" />
        <div className="form-hint">Include street, city, and any unit details so the crew can find the appointment quickly.</div>
        {errors.address && <div className="form-error">{errors.address}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="jobType">Job type</label>
        <select
          id="jobType"
          name="jobType"
          required
          className="jobs-status-select"
          onChange={handleChange}
          value={formData.jobType}
        >
          <option value="">Select a job type</option>
          {JOB_TYPE_OPTIONS.map((jobType) => (
            <option key={jobType} value={jobType}>
              {jobType}
            </option>
          ))}
        </select>
        <div className="form-hint">Each job type has its own calendar color so appointments are easy to scan.</div>
        {errors.jobType && <div className="form-error">{errors.jobType}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="jobDate">Date</label>
        <input id="jobDate" name="jobDate" type="date" required onChange={handleChange} value={formData.jobDate} placeholder="YYYY-MM-DD" />
        {errors.jobDate && <div className="form-error">{errors.jobDate}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="startTime">Start time</label>
        <input
          id="startTime"
          name="startTime"
          type="time"
          required
          onChange={handleChange}
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
          onChange={handleChange}
          value={formData.payment}
          placeholder="0.00"
        />
        {errors.payment && <div className="form-error">{errors.payment}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="comments">Comments</label>
        <textarea id="comments" name="comments" onChange={handleChange} value={formData.comments} placeholder="Gate code 2468. Park in driveway. Customer prefers afternoon arrival."></textarea>
        <div className="form-hint">Add gate codes, parking notes, scope details, or anything the team should know before arrival.</div>
        {errors.comments && <div className="form-error">{errors.comments}</div>}
      </div>

      {errors.submit && <div className="form-error-message">{errors.submit}</div>}
      {successMessage && <div className="form-success-message">{successMessage}</div>}

      <button
        type="submit"
        disabled={hasErrors || !currentUser}
        className="form-submit-button"
      >
        Save appointment
      </button>
    </form>
  )
}
