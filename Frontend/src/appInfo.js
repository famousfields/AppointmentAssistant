const normalizeBase = (value) => String(value || '').trim().replace(/\/+$/, '')

export const APP_WEB_BASE = normalizeBase(
  import.meta.env?.VITE_APP_BASE ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://appointmentassistant.netlify.app')
)

export const SUPPORT_EMAIL = String(import.meta.env?.VITE_SUPPORT_EMAIL || '').trim()

export const PUBLIC_PATHS = {
  privacy: '/privacy',
  support: '/support',
  account: '/account'
}

export const getPublicAppUrl = (path = '') => {
  const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`
  return `${APP_WEB_BASE}${normalizedPath}`
}
