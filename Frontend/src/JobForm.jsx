import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function JobForm({ currentUser }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    jobType: '',
    jobDate: '',
    comments: ''
  })
  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()
  const redirectTimer = useRef(null)

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
      case 'comments':
        if (value && value.length > 500) return 'Comments max 500 chars'
        return ''
      default:
        return ''
    }
  }

  const handleChange = (e) => {
    let { name, value } = e.target

    if (name === 'phone') {
      value = value.replace(/\D/g, '')
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
      const res = await fetch('http://localhost:5000/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          userId: currentUser?.id ?? null
        })
      })

      const data = await res.json()
      if (res.ok) {
        setErrors((prev) => ({ ...prev, submit: '' }))
        setSuccessMessage('Job created! Redirecting to Jobs...')
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
        <input id="name" name="name" type="text" required onChange={handleChange} value={formData.name} />
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
          required
          onChange={handleChange}
          value={formData.phone}
        />
        {errors.phone && <div className="form-error">{errors.phone}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="address">Address</label>
        <input id="address" name="address" type="text" required onChange={handleChange} value={formData.address} />
        {errors.address && <div className="form-error">{errors.address}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="jobType">Job type</label>
        <input id="jobType" name="jobType" type="text" required onChange={handleChange} value={formData.jobType} />
        {errors.jobType && <div className="form-error">{errors.jobType}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="jobDate">Date</label>
        <input id="jobDate" name="jobDate" type="date" required onChange={handleChange} value={formData.jobDate} />
        {errors.jobDate && <div className="form-error">{errors.jobDate}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="comments">Comments</label>
        <textarea id="comments" name="comments" onChange={handleChange} value={formData.comments}></textarea>
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
