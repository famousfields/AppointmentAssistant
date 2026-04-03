import AsyncStorage from '@react-native-async-storage/async-storage'

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:5000'

const SESSION_KEY = 'appointment-assistant-mobile:session'
const JOB_DRAFT_KEY = 'appointment-assistant-mobile:job-draft'

const normalizeBase64Url = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  if (padding === 0) return normalized
  return `${normalized}${'='.repeat(4 - padding)}`
}

const decodeBase64 = (value) => {
  try {
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(normalizeBase64Url(value))
    }

    if (typeof globalThis.Buffer?.from === 'function') {
      return globalThis.Buffer.from(normalizeBase64Url(value), 'base64').toString('utf8')
    }
  } catch {
    return null
  }

  return null
}

export const getTokenPayload = (token) => {
  if (!token) return null
  const segments = token.split('.')
  if (segments.length !== 3) return null
  const decoded = decodeBase64(segments[1])
  if (!decoded) return null

  try {
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export const getTokenExpiry = (token) => {
  const payload = getTokenPayload(token)
  return typeof payload?.exp === 'number' ? payload.exp * 1000 : null
}

export const buildSessionRecord = ({ user, accessToken, refreshToken }) => {
  if (!accessToken || !refreshToken) return null

  return {
    user,
    accessToken,
    refreshToken,
    expiresAt: getTokenExpiry(accessToken)
  }
}

export const loadStoredSession = async () => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed.accessToken || !parsed.refreshToken) {
      await AsyncStorage.removeItem(SESSION_KEY)
      return null
    }

    return {
      ...parsed,
      expiresAt: parsed.expiresAt ?? getTokenExpiry(parsed.accessToken)
    }
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY)
    return null
  }
}

export const persistSession = async (session) => {
  if (!session) {
    await AsyncStorage.removeItem(SESSION_KEY)
    return
  }

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export const loadJobDraft = async () => {
  try {
    const raw = await AsyncStorage.getItem(JOB_DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const persistJobDraft = async (draft) => {
  const hasDraftContent = Object.values(draft || {}).some((value) =>
    String(value ?? '').trim().length > 0
  )

  if (!hasDraftContent) {
    await AsyncStorage.removeItem(JOB_DRAFT_KEY)
    return
  }

  await AsyncStorage.setItem(JOB_DRAFT_KEY, JSON.stringify(draft))
}

export const clearJobDraft = async () => {
  await AsyncStorage.removeItem(JOB_DRAFT_KEY)
}

export async function apiFetch(path, { accessToken, refreshToken, onSessionChange, ...options } = {}) {
  const request = async (token) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    })
  }

  let response = await request(accessToken)

  if (response.status === 401 && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    })

    if (!refreshResponse.ok) {
      await onSessionChange?.(null)
      return response
    }

    const payload = await refreshResponse.json()
    const nextSession = buildSessionRecord({
      user: payload.user,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken || refreshToken
    })

    if (!nextSession) {
      await onSessionChange?.(null)
      return response
    }

    await onSessionChange?.(nextSession)
    response = await request(nextSession.accessToken)
  }

  return response
}
