import { getFinancialStatus, getFinancialStatusMeta, getJobStatusMeta } from './statusUtils'

export function StatusChip({ children, tone = 'neutral', className = '' }) {
  return (
    <span className={`status-chip status-chip--${tone}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  )
}

export function JobStatusChips({ job, className = '' }) {
  const jobStatus = getJobStatusMeta(job?.status)
  const financialStatus = getFinancialStatus(job)

  return (
    <div className={`status-chip-row${className ? ` ${className}` : ''}`}>
      <StatusChip tone={jobStatus.tone}>{jobStatus.label}</StatusChip>
      {financialStatus ? (
        <StatusChip tone={getFinancialStatusMeta(financialStatus).tone}>
          {getFinancialStatusMeta(financialStatus).label}
        </StatusChip>
      ) : null}
    </div>
  )
}

export function SectionCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
  compact = false
}) {
  return (
    <section className={`section-card${compact ? ' section-card--compact' : ''}${className ? ` ${className}` : ''}`}>
      {(eyebrow || title || description || action) ? (
        <div className="section-card__header">
          <div className="section-card__copy">
            {eyebrow ? <p className="section-card__eyebrow">{eyebrow}</p> : null}
            {title ? <h3 className="section-card__title">{title}</h3> : null}
            {description ? <p className="section-card__description">{description}</p> : null}
          </div>
          {action ? <div className="section-card__action">{action}</div> : null}
        </div>
      ) : null}
      <div className="section-card__body">{children}</div>
    </section>
  )
}

export function MetricCard({ label, value, helper, tone = 'default' }) {
  return (
    <div className={`metric-card metric-card--${tone}`}>
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      {helper ? <span className="metric-card__helper">{helper}</span> : null}
    </div>
  )
}

export function EmptyState({ title, description, action, className = '' }) {
  return (
    <div className={`empty-state-panel${className ? ` ${className}` : ''}`}>
      <div className="empty-state-panel__icon" aria-hidden="true">
        +
      </div>
      <div className="empty-state-panel__copy">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      {action ? <div className="empty-state-panel__action">{action}</div> : null}
    </div>
  )
}
