export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const safeBase64Decode = (value) => {
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(value)
    }
    if (typeof Buffer === 'function') {
      return Buffer.from(value, 'base64').toString('utf8')
    }
  } catch (error) {
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
  } catch (error) {
    return null
  }
}

export const getTokenExpiry = (token) => {
  const payload = getTokenPayload(token)
  if (!payload || typeof payload.exp !== 'number') return null
  return payload.exp * 1000
}
