import { useCallback, useEffect, useState } from 'react'

export default function useSubscription(currentUser, fetchWithAuth) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(Boolean(currentUser))
  const [error, setError] = useState('')

  const refreshSubscription = useCallback(async () => {
    if (!currentUser) {
      setSummary(null)
      setError('')
      setLoading(false)
      return null
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetchWithAuth('/billing/summary')
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to load billing details')
      }

      const payload = await response.json()
      setSummary(payload)
      return payload
    } catch (nextError) {
      console.error('Failed to load billing details:', nextError)
      setSummary(null)
      setError(nextError.message || 'Unable to load billing details')
      return null
    } finally {
      setLoading(false)
    }
  }, [currentUser, fetchWithAuth])

  const changePlan = useCallback(
    async (planCode) => {
      const response = await fetchWithAuth('/billing/subscription', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ planCode })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || payload.errors?.[0]?.msg || 'Unable to update plan')
      }

      if (payload.subscription) {
        setSummary(payload.subscription)
      }

      return payload
    },
    [fetchWithAuth]
  )

  useEffect(() => {
    refreshSubscription()
  }, [refreshSubscription])

  return {
    summary,
    loading,
    error,
    refreshSubscription,
    changePlan
  }
}
