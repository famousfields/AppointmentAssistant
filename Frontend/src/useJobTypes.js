import { useCallback, useEffect, useState } from 'react'
import { useApi } from './apiContext'

const normalizeJobTypePayload = (jobType) => ({
  name: String(jobType?.name || '').trim(),
  color: String(jobType?.color || '').trim()
})

export default function useJobTypes(currentUser) {
  const [jobTypes, setJobTypes] = useState([])
  const [loading, setLoading] = useState(Boolean(currentUser))
  const [error, setError] = useState('')
  const { fetchWithAuth } = useApi()

  const refreshJobTypes = useCallback(async () => {
    if (!currentUser) {
      setJobTypes([])
      setError('')
      setLoading(false)
      return []
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetchWithAuth('/job-types')
      if (!res.ok) {
        throw new Error('Unable to load job types')
      }

      const data = await res.json()
      const nextJobTypes = Array.isArray(data) ? data : []
      setJobTypes(nextJobTypes)
      return nextJobTypes
    } catch (nextError) {
      console.error('Failed to load job types:', nextError)
      setError(nextError.message || 'Unable to load job types')
      setJobTypes([])
      return []
    } finally {
      setLoading(false)
    }
  }, [currentUser, fetchWithAuth])

  const createJobType = useCallback(
    async (jobType) => {
      const payload = normalizeJobTypePayload(jobType)
      const res = await fetchWithAuth('/job-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.errors?.[0]?.msg || 'Unable to create job type')
      }

      const created = await res.json()
      setJobTypes((current) => [...current, created].sort((first, second) => {
        const firstOrder = Number(first.sort_order ?? 0)
        const secondOrder = Number(second.sort_order ?? 0)
        if (firstOrder !== secondOrder) return firstOrder - secondOrder
        return String(first.name || '').localeCompare(String(second.name || ''))
      }))
      return created
    },
    [fetchWithAuth]
  )

  const updateJobType = useCallback(
    async (jobTypeId, jobType) => {
      const payload = normalizeJobTypePayload(jobType)
      const res = await fetchWithAuth(`/job-types/${jobTypeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.errors?.[0]?.msg || 'Unable to update job type')
      }

      const updated = await res.json()
      setJobTypes((current) =>
        [...current.filter((item) => String(item.id) !== String(jobTypeId)), updated].sort((first, second) => {
          const firstOrder = Number(first.sort_order ?? 0)
          const secondOrder = Number(second.sort_order ?? 0)
          if (firstOrder !== secondOrder) return firstOrder - secondOrder
          return String(first.name || '').localeCompare(String(second.name || ''))
        })
      )
      return updated
    },
    [fetchWithAuth]
  )

  const deleteJobType = useCallback(
    async (jobTypeId) => {
      const res = await fetchWithAuth(`/job-types/${jobTypeId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to delete job type')
      }

      setJobTypes((current) => current.filter((item) => String(item.id) !== String(jobTypeId)))
    },
    [fetchWithAuth]
  )

  useEffect(() => {
    refreshJobTypes()
  }, [refreshJobTypes])

  return {
    jobTypes,
    loading,
    error,
    refreshJobTypes,
    createJobType,
    updateJobType,
    deleteJobType,
    setJobTypes
  }
}
