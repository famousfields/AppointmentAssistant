import { useState } from 'react'
import ClientSuggestions from './ClientSuggestions'
import {
  applyClientSuggestion,
  formatPhonePreview,
  normalizePhoneDigits
} from './clientUtils'
import { formatDateInputValue, parseDateValue } from './dateUtils'
import { buildJobTypeSuggestionSet } from './jobTypes'
import GoogleMapsLink from './GoogleMapsLink'
import { JobStatusChips, SectionCard } from './productUi'

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']
const PHONE_EXAMPLE = '(555) 123-4567'

const buildFormState = (job) => ({
  name: job?.name || '',
  phone: normalizePhoneDigits(job?.phone || ''),
  address: job?.address || '',
  jobType: job?.job_type || '',
  jobDate: formatDateInputValue(job?.job_date),
  startTime: job?.start_time ? String(job.start_time).slice(0, 5) : '',
  status: job?.status || 'Pending',
  payment: job?.payment === null || job?.payment === undefined ? '' : String(job.payment),
  comments: job?.comments || ''
})

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

export default function JobEditorModal({
  job,
  clients = [],
  jobTypes = [],
  saving,
  deleting = false,
  error,
  onClose,
  onSave,
  onDelete
}) {
  const [formData, setFormData] = useState(() => buildFormState(job))
  const [fieldErrors, setFieldErrors] = useState({})
  const [suggestionField, setSuggestionField] = useState(null)
  const jobTypeSuggestions = buildJobTypeSuggestionSet(jobTypes)

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
        return parseDateValue(value) ? '' : 'Date is required'
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
      value = normalizePhoneDigits(value)
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
  }

  const applyExistingClient = (client) => {
    setFormData((prev) => ({ ...prev, ...applyClientSuggestion(client) }))
    setFieldErrors((prev) => ({ ...prev, name: '', phone: '', address: '' }))
    setSuggestionField(null)
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

  const scheduleLabel = formatSchedulePreview(formData.jobDate, formData.startTime)

  return (
    <div className="comments-modal-backdrop" onClick={onClose}>
      <div className="comments-modal job-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="comments-modal-header job-editor-modal__header">
          <div>
            <p className="section-card__eyebrow">Job Command Center</p>
            <h3>Edit job for {job.name}</h3>
            <p className="comments-modal-subtitle">
              Adjust client details, scheduling, payment, and notes without losing context.
            </p>
          </div>
          <JobStatusChips job={{ ...job, ...formData, payment: formData.payment }} />
        </div>

        <form className="job-editor-form" onSubmit={handleSubmit}>
          <SectionCard
            eyebrow="Client"
            title="Who and where"
            description="Update the customer record or switch to an existing client when the details match."
            compact
          >
            <div className="form-grid form-grid--two">
              <div className="form-group">
                <label htmlFor="edit-name">Client name</label>
                <input
                  id="edit-name"
                  name="name"
                  value={formData.name}
                  onChange={(event) => {
                    handleChange(event)
                    setSuggestionField('name')
                  }}
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
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
                  onChange={(event) => {
                    handleChange(event)
                    setSuggestionField('phone')
                  }}
                />
                <p className="form-hint">Digits only. Preview: {formatPhonePreview(formData.phone)}</p>
                {fieldErrors.phone && <p className="form-error">{fieldErrors.phone}</p>}
              </div>
            </div>

            <ClientSuggestions
              clients={clients}
              query={suggestionField === 'phone' ? formData.phone : formData.name}
              field={suggestionField === 'phone' ? 'phone' : 'name'}
              visible={suggestionField === 'name' || suggestionField === 'phone'}
              onSelect={applyExistingClient}
              onCreateNew={() => setSuggestionField(null)}
              createLabel="Keep current client as entered"
            />

            <div className="form-group">
              <label htmlFor="edit-address">Address</label>
              <input
                id="edit-address"
                name="address"
                value={formData.address}
                onChange={(event) => {
                  handleChange(event)
                  setSuggestionField('address')
                }}
                placeholder="123 Main St, Springfield, IL 62704"
                autoComplete="street-address"
              />
              <div className="form-inline-actions">
                <GoogleMapsLink address={formData.address} />
                <span className="form-hint">Keep the routeable service address current for the field team.</span>
              </div>
              {fieldErrors.address && <p className="form-error">{fieldErrors.address}</p>}
            </div>

            <ClientSuggestions
              clients={clients}
              query={formData.address}
              field="address"
              visible={suggestionField === 'address'}
              onSelect={applyExistingClient}
              onCreateNew={() => setSuggestionField(null)}
              createLabel="Use this address"
            />
          </SectionCard>

          <SectionCard
            eyebrow="Schedule"
            title="When the team is expected"
            description={scheduleLabel}
            compact
          >
            <div className="form-grid form-grid--three">
              <div className="form-group">
                <label htmlFor="edit-job-type">Job type</label>
                <input
                  id="edit-job-type"
                  name="jobType"
                  list="edit-job-type-options"
                  value={formData.jobType}
                  onChange={(event) => {
                    handleChange(event)
                    setSuggestionField(null)
                  }}
                  placeholder="Mulch installation"
                />
                <datalist id="edit-job-type-options">
                  {jobTypeSuggestions.map((jobType) => (
                    <option key={jobType} value={jobType} />
                  ))}
                </datalist>
                <p className="form-hint">Keep the work type specific so dispatch and reporting stay clear.</p>
                {fieldErrors.jobType && <p className="form-error">{fieldErrors.jobType}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="edit-job-date">Date</label>
                <input
                  id="edit-job-date"
                  name="jobDate"
                  type="date"
                  value={formData.jobDate}
                  onChange={(event) => {
                    handleChange(event)
                    setSuggestionField(null)
                  }}
                />
                {fieldErrors.jobDate && <p className="form-error">{fieldErrors.jobDate}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="edit-start-time">Start time</label>
                <input
                  id="edit-start-time"
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(event) => {
                    handleChange(event)
                    setSuggestionField(null)
                  }}
                />
                <p className="form-hint">The schedule assumes a one-hour visit starting here.</p>
                {fieldErrors.startTime && <p className="form-error">{fieldErrors.startTime}</p>}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Revenue"
            title="Status, payment, and notes"
            description="These fields should make invoicing and follow-up obvious for the office."
            compact
          >
            <div className="form-grid form-grid--three">
              <div className="form-group">
                <label htmlFor="edit-status">Status</label>
                <select
                  id="edit-status"
                  name="status"
                  className="jobs-status-select"
                  value={formData.status}
                  onChange={(event) => {
                    handleChange(event)
                    setSuggestionField(null)
                  }}
                >
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
                  onChange={(event) => {
                    handleChange(event)
                    setSuggestionField(null)
                  }}
                />
                {fieldErrors.payment && <p className="form-error">{fieldErrors.payment}</p>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="edit-comments">Comments</label>
              <textarea
                id="edit-comments"
                name="comments"
                value={formData.comments}
                onChange={(event) => {
                  handleChange(event)
                  setSuggestionField(null)
                }}
                placeholder="Gate code 2468. Park in driveway. Customer prefers afternoon arrival."
              />
              <p className="form-hint">Keep notes crisp and operational so they are usable in the field.</p>
              {fieldErrors.comments && <p className="form-error">{fieldErrors.comments}</p>}
            </div>
          </SectionCard>

          {error && <p className="comments-modal-error">{error}</p>}

          <div className="job-editor-footer">
            <div className="job-editor-footer__summary">
              <strong>{scheduleLabel}</strong>
              <span>{formData.address || 'Address not set yet'}</span>
            </div>
            <div className="comments-modal-actions">
              <button
                type="button"
                className="comments-modal-button comments-modal-button--ghost"
                onClick={onClose}
                disabled={saving || deleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="comments-modal-button comments-modal-button--primary"
                disabled={saving || deleting}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>

          {onDelete ? (
            <button
              type="button"
              className="comments-modal-button comments-modal-button--danger job-editor-delete"
              onClick={() => onDelete(job)}
              disabled={saving || deleting}
            >
              {deleting ? 'Deleting...' : 'Delete job'}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  )
}
