import { useState } from 'react'

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']

const buildFormState = (job) => ({
  name: job?.name || '',
  phone: job?.phone || '',
  address: job?.address || '',
  jobType: job?.job_type || '',
  jobDate: job?.job_date ? String(job.job_date).slice(0, 10) : '',
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
      value = value.replace(/\D/g, '')
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
            <input id="edit-name" name="name" value={formData.name} onChange={handleChange} />
            {fieldErrors.name && <p className="form-error">{fieldErrors.name}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-phone">Phone</label>
            <input id="edit-phone" name="phone" value={formData.phone} onChange={handleChange} />
            {fieldErrors.phone && <p className="form-error">{fieldErrors.phone}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-address">Address</label>
            <input id="edit-address" name="address" value={formData.address} onChange={handleChange} />
            {fieldErrors.address && <p className="form-error">{fieldErrors.address}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-job-type">Job type</label>
            <input id="edit-job-type" name="jobType" value={formData.jobType} onChange={handleChange} />
            {fieldErrors.jobType && <p className="form-error">{fieldErrors.jobType}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-job-date">Date</label>
            <input id="edit-job-date" name="jobDate" type="date" value={formData.jobDate} onChange={handleChange} />
            {fieldErrors.jobDate && <p className="form-error">{fieldErrors.jobDate}</p>}
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
              value={formData.payment}
              onChange={handleChange}
            />
            {fieldErrors.payment && <p className="form-error">{fieldErrors.payment}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-comments">Comments</label>
            <textarea id="edit-comments" name="comments" value={formData.comments} onChange={handleChange} />
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
