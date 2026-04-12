import { useState } from 'react'
import { JOB_TYPE_OPTIONS } from './jobTypes'

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']
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

const buildFormState = (job) => ({
  name: job?.name || '',
  phone: job?.phone || '',
  address: job?.address || '',
  jobType: job?.job_type || '',
  jobDate: job?.job_date ? String(job.job_date).slice(0, 10) : '',
  startTime: job?.start_time ? String(job.start_time).slice(0, 5) : '',
  status: job?.status || 'Pending',
  payment: job?.payment === null || job?.payment === undefined ? '' : String(job.payment),
  comments: job?.comments || ''
})

export default function JobEditorModal({ job, saving, error, onClose, onSave }) {
  const [formData, setFormData] = useState(() => buildFormState(job))
  const [fieldErrors, setFieldErrors] = useState({})

  if (!job) return null

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        return value.trim().length >= 2 ? '' : 'Name must be at least 2 characters'
      case 'phone': {
        const digits = value.replace(/\D/g, '')
        return digits.length >= 7 && digits.length <= 15 ? '' : 'Phone must be 7-15 digits'
      }
      case 'address':
        return value.trim().length >= 5 ? '' : 'Address must be at least 5 characters'
      case 'jobType':
        return value.trim() ? '' : 'Job type is required'
      case 'jobDate':
        return value ? '' : 'Date is required'
      case 'startTime':
        if (!value) return 'Start time is required'
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? '' : 'Use HH:MM in 24-hour time'
      case 'payment':
        if (!value) return ''
        if (!/^\d+(\.\d{0,2})?$/.test(value)) return 'Use a valid amount with up to 2 decimals'
        return ''
      case 'comments':
        return value.length <= 500 ? '' : 'Comments max 500 chars'
      default:
        return ''
    }
  }

  const handleChange = (event) => {
    let { name, value } = event.target
    if (name === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 15)
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nextErrors = Object.keys(formData).reduce((accumulator, key) => {
      const message = validateField(key, formData[key])
      if (message) {
        accumulator[key] = message
      }
      return accumulator
    }, {})

    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    await onSave({
      name: formData.name.trim(),
      phone: formData.phone,
      address: formData.address.trim(),
      jobType: formData.jobType.trim(),
      jobDate: formData.jobDate,
      startTime: formData.startTime,
      status: formData.status,
      payment: formData.payment === '' ? 0 : Number(formData.payment),
      comments: formData.comments.trim()
    })
  }

  return (
    <div className="comments-modal-backdrop" onClick={onClose}>
      <div className="comments-modal job-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="comments-modal-header">
          <h3>Edit job for {job.name}</h3>
          <p className="comments-modal-subtitle">
            Update client details, scheduling, payment, and notes in one place.
          </p>
        </div>

        <form className="job-editor-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-name">Client name</label>
            <input id="edit-name" name="name" value={formData.name} onChange={handleChange} placeholder="Jane Smith" />
            {fieldErrors.name && <p className="form-error">{fieldErrors.name}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-phone">Phone</label>
            <input
              id="edit-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder={PHONE_EXAMPLE}
              maxLength={15}
              value={formData.phone}
              onChange={handleChange}
            />
            <p className="form-hint">Enter digits only. Preview: {formatPhonePreview(formData.phone)}</p>
            {fieldErrors.phone && <p className="form-error">{fieldErrors.phone}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-address">Address</label>
            <input id="edit-address" name="address" value={formData.address} onChange={handleChange} placeholder="123 Main St, Springfield, IL 62704" />
            <p className="form-hint">Include street, city, and any unit details so the crew can find the appointment quickly.</p>
            {fieldErrors.address && <p className="form-error">{fieldErrors.address}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-job-type">Job type</label>
            <select
              id="edit-job-type"
              name="jobType"
              className="jobs-status-select"
              value={formData.jobType}
              onChange={handleChange}
            >
              <option value="">Select a job type</option>
              {JOB_TYPE_OPTIONS.map((jobType) => (
                <option key={jobType} value={jobType}>
                  {jobType}
                </option>
              ))}
            </select>
            {fieldErrors.jobType && <p className="form-error">{fieldErrors.jobType}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-job-date">Date</label>
            <input id="edit-job-date" name="jobDate" type="date" value={formData.jobDate} onChange={handleChange} />
            {fieldErrors.jobDate && <p className="form-error">{fieldErrors.jobDate}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-start-time">Start time</label>
            <input id="edit-start-time" name="startTime" type="time" value={formData.startTime} onChange={handleChange} />
            <p className="form-hint">Each job reserves a one-hour timeslot starting at this time.</p>
            {fieldErrors.startTime && <p className="form-error">{fieldErrors.startTime}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-status">Status</label>
            <select id="edit-status" name="status" className="jobs-status-select" value={formData.status} onChange={handleChange}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-payment">Payment</label>
            <input
              id="edit-payment"
              name="payment"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formData.payment}
              onChange={handleChange}
            />
            {fieldErrors.payment && <p className="form-error">{fieldErrors.payment}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-comments">Comments</label>
            <textarea id="edit-comments" name="comments" value={formData.comments} onChange={handleChange} placeholder="Gate code 2468. Park in driveway. Customer prefers afternoon arrival." />
            <p className="form-hint">Add gate codes, parking notes, scope details, or anything the team should know before arrival.</p>
            {fieldErrors.comments && <p className="form-error">{fieldErrors.comments}</p>}
          </div>

          {error && <p className="comments-modal-error">{error}</p>}

          <div className="comments-modal-actions">
            <button
              type="button"
              className="comments-modal-button comments-modal-button--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="comments-modal-button comments-modal-button--primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
