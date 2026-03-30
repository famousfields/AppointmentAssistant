export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

export const authFetch = (path, accessToken, options = {}) => {
  const headers = {
    ...(options.headers || {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })
}
