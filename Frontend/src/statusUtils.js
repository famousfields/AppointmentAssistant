const JOB_STATUS_META = {
  Pending: {
    label: 'Scheduled',
    tone: 'scheduled'
  },
  'In Progress': {
    label: 'In Progress',
    tone: 'progress'
  },
  Completed: {
    label: 'Completed',
    tone: 'success'
  },
  Cancelled: {
    label: 'Cancelled',
    tone: 'danger'
  }
}

const FINANCIAL_STATUS_META = {
  Invoiced: {
    label: 'Invoiced',
    tone: 'warning'
  },
  Paid: {
    label: 'Paid',
    tone: 'success'
  }
}

export const getJobStatusMeta = (status) =>
  JOB_STATUS_META[status] || {
    label: status || 'Unscheduled',
    tone: 'neutral'
  }

export const getFinancialStatusMeta = (status) =>
  FINANCIAL_STATUS_META[status] || {
    label: status,
    tone: 'neutral'
  }

export const getFinancialStatus = (job) => {
  const payment = Number(job?.payment) || 0
  if (payment <= 0) return null
  return job?.status === 'Completed' ? 'Paid' : 'Invoiced'
}
