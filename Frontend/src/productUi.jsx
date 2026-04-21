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

export function FlowStepper({ steps, currentStep, onStepSelect }) {
  return (
    <div className="flow-stepper" role="tablist" aria-label="Job creation steps">
      {steps.map((step, index) => {
        const state =
          index === currentStep ? 'current' : index < currentStep ? 'complete' : 'upcoming'

        return (
          <button
            key={step.key}
            type="button"
            role="tab"
            aria-selected={index === currentStep}
            className={`flow-stepper__item flow-stepper__item--${state}`}
            onClick={() => onStepSelect(index)}
          >
            <span className="flow-stepper__index">{index + 1}</span>
            <span className="flow-stepper__copy">
              <span className="flow-stepper__title">{step.title}</span>
              <span className="flow-stepper__description">{step.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
