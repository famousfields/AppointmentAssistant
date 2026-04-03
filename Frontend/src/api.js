export const API_BASE = import.meta.env?.VITE_API_BASE || 'http://localhost:5000'

const normalizeBase64Url = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  if (padding === 0) return normalized
  return `${normalized}${'='.repeat(4 - padding)}`
}

const safeBase64Decode = (value) => {
  try {
    const normalized = normalizeBase64Url(value)
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(normalized)
    }
    if (typeof globalThis.Buffer === 'function') {
      return globalThis.Buffer.from(normalized, 'base64').toString('utf8')
    }
  } catch {
    // Fall through to return null
  }
  return null
}

export const getTokenPayload = (token) => {
  if (!token) return null
  const segments = token.split('.')
  if (segments.length !== 3) return null
  const payloadSegment = segments[1]
  const decoded = safeBase64Decode(payloadSegment)
  if (!decoded) return null
  try {
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export const getTokenExpiry = (token) => {
  const payload = getTokenPayload(token)
  if (!payload || typeof payload.exp !== 'number') return null
  return payload.exp * 1000
}
