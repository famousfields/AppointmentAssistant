export const JOB_TYPE_OPTIONS = [
  '0 Turn Mower',
  'Push Mower',
  'Riding Mower',
  'Pressure Washer'
]

export const JOB_TYPE_COLORS = {
  '0 Turn Mower': {
    background: '#22c55e',
    border: '#16a34a',
    text: '#f0fdf4'
  },
  'Push Mower': {
    background: '#f97316',
    border: '#ea580c',
    text: '#fff7ed'
  },
  'Riding Mower': {
    background: '#3b82f6',
    border: '#2563eb',
    text: '#eff6ff'
  },
  'Pressure Washer': {
    background: '#06b6d4',
    border: '#0891b2',
    text: '#ecfeff'
  }
}

export const normalizeJobType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()

  return (
    JOB_TYPE_OPTIONS.find((option) => option.toLowerCase() === normalized) ||
    JOB_TYPE_OPTIONS[0]
  )
}

export const getJobTypePalette = (value) =>
  JOB_TYPE_COLORS[normalizeJobType(value)] || JOB_TYPE_COLORS[JOB_TYPE_OPTIONS[0]]
