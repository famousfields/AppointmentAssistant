import { getDateTimestamp } from './dateUtils'

export const normalizePhoneDigits = (value) =>
  String(value || '').replace(/\D/g, '').slice(0, 15)

export const formatPhonePreview = (value) => {
  const digits = normalizePhoneDigits(value)

  if (!digits) return '(555) 123-4567'

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

export const buildClients = (jobs) => {
  const map = new Map()

  jobs.forEach((job) => {
    const clientId = job.client_id ?? `${job.name}|${job.phone}|${job.address}`
    if (!map.has(clientId)) {
      map.set(clientId, {
        id: clientId,
        name: job.name || '',
        phone: job.phone || '',
        address: job.address || '',
        jobs: []
      })
    }
    map.get(clientId).jobs.push(job)
  })

  return Array.from(map.values())
    .map((client) => {
      const sortedJobs = [...client.jobs].sort(
        (a, b) => getDateTimestamp(b.job_date) - getDateTimestamp(a.job_date)
      )
      const totalPayments = sortedJobs.reduce(
        (sum, job) => sum + (Number.parseFloat(job.payment) || 0),
        0
      )
      return { ...client, jobs: sortedJobs, totalPayments }
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
}

export const buildClientSuggestions = (clients, query, field) => {
  const value = String(query || '').trim().toLowerCase()
  if (!value) return []

  if (field === 'phone') {
    const digits = normalizePhoneDigits(query)
    if (!digits) return []
    return clients.filter((client) => normalizePhoneDigits(client.phone || '').includes(digits))
  }

  return clients.filter((client) => String(client[field] || '').toLowerCase().includes(value))
}

export const applyClientSuggestion = (client) => ({
  name: client.name || '',
  phone: normalizePhoneDigits(client.phone || ''),
  address: client.address || ''
})
