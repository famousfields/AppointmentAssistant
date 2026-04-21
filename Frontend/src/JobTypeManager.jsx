import { useMemo, useState } from 'react'
import { buildJobTypePalette, getJobTypeOptions, normalizeJobTypeColor, normalizeJobTypeName } from './jobTypes'

const EMPTY_DRAFT = {
  name: '',
  color: '#6d7cff'
}

export default function JobTypeManager({
  jobTypes = [],
  loading = false,
  error = '',
  disabled = false,
  disabledMessage = 'Log in to manage job types.',
  onCreate,
  onUpdate,
  onDelete
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)

  const sortedJobTypes = useMemo(() => getJobTypeOptions(jobTypes), [jobTypes])

  const handleEdit = (jobType) => {
    setEditingId(jobType.id)
    setDraft({
      name: jobType.name || '',
      color: normalizeJobTypeColor(jobType.color) || '#6d7cff'
    })
    setSubmitError('')
  }

  const handleReset = () => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setSubmitError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const name = normalizeJobTypeName(draft.name)
    if (!name) {
      setSubmitError('Enter a job type name')
      return
    }

    setSaving(true)
    setSubmitError('')

    try {
      if (editingId) {
        await onUpdate?.(editingId, { name, color: draft.color })
      } else {
        await onCreate?.({ name, color: draft.color })
      }
      handleReset()
    } catch (nextError) {
      setSubmitError(nextError.message || 'Unable to save job type')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (jobType) => {
    const confirmed = window.confirm(`Delete the ${jobType.name} job type?`)
    if (!confirmed) return

    setSaving(true)
    setSubmitError('')
    try {
      await onDelete?.(jobType.id)
      if (editingId === jobType.id) {
        handleReset()
      }
    } catch (nextError) {
      setSubmitError(nextError.message || 'Unable to delete job type')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="job-types-panel">
      <div className="job-types-panel__header">
        <div>
          <h3>Job types</h3>
          <p>Define the work labels your business uses and choose the color that appears in the calendar.</p>
        </div>
        {editingId ? (
          <button type="button" className="comments-button comments-button--ghost" onClick={handleReset} disabled={saving || disabled}>
            Cancel edit
          </button>
        ) : null}
      </div>

      {disabled ? (
        <div className="job-types-panel__locked">
          {error ? <p className="form-error">{error}</p> : null}
          <p className="form-hint">{disabledMessage}</p>
        </div>
      ) : (
        <>
          <form className="job-types-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="job-type-name">Name</label>
              <input
                id="job-type-name"
                type="text"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Mulch installation"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="job-type-color">Color</label>
              <div className="job-type-color-row">
                <input
                  id="job-type-color"
                  type="color"
                  value={normalizeJobTypeColor(draft.color) || '#6d7cff'}
                  onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                  aria-label="Choose job type color"
                  disabled={saving}
                />
                <span className="job-types-color-label">{normalizeJobTypeColor(draft.color) || '#6d7cff'}</span>
              </div>
            </div>

            <button type="submit" className="comments-button" disabled={saving}>
              {editingId ? 'Save job type' : 'Add job type'}
            </button>

            {submitError ? <p className="form-error">{submitError}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
          </form>

          {loading ? (
            <p>Loading job types...</p>
          ) : sortedJobTypes.length === 0 ? (
            <p>No job types yet. Add your first business-specific category above.</p>
          ) : (
            <div className="job-types-list">
              {sortedJobTypes.map((jobType) => {
                const palette = buildJobTypePalette(jobType.color, jobType.name)

                return (
                  <div key={jobType.id} className="job-types-item" style={{ '--job-bg': palette.background, '--job-border': palette.border, '--job-text': palette.text }}>
                    <span className="job-types-item__swatch" style={{ backgroundColor: palette.background }} />
                    <div className="job-types-item__content">
                      <strong>{jobType.name}</strong>
                      <span>{normalizeJobTypeColor(jobType.color)}</span>
                    </div>
                    <div className="job-types-item__actions">
                      <button type="button" className="comments-button" onClick={() => handleEdit(jobType)} disabled={saving}>
                        Edit
                      </button>
                      <button type="button" className="comments-button comments-button--danger" onClick={() => handleDelete(jobType)} disabled={saving}>
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
