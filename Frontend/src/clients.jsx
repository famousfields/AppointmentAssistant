import { useApi } from './apiContext'
import { useCallback, useEffect, useMemo, useState } from 'react'
import JobEditorModal from './JobEditorModal'
import { buildClients } from './clientUtils'
import { formatDisplayDate } from './dateUtils'

const formatDate = (dateString) =>
  formatDisplayDate(dateString, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

const formatTimeRange = (timeValue) => {
  if (!timeValue) return '-'
  const [hoursText = '0', minutesText = '00'] = String(timeValue).split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '-'

  const start = new Date(2000, 0, 1, hours, minutes)
  const end = new Date(2000, 0, 1, hours + 1, minutes)

  return `${start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })} - ${end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })}`
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value) || 0)

export default function ClientsList({ currentUser }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeClientId, setActiveClientId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingJob, setEditingJob] = useState(null)
  const [isSavingJob, setIsSavingJob] = useState(false)
  const [editError, setEditError] = useState('')
  const { fetchWithAuth } = useApi()

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchWithAuth('/jobs')
      if (!res.ok) throw new Error('Unable to load jobs')
      const data = await res.json()
      setJobs(data)
    } catch (err) {
      console.error('Failed fetching jobs:', err)
      setError("We couldn't load client data right now.")
    } finally {
      setLoading(false)
    }
  }, [fetchWithAuth])

  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      setJobs([])
      setError('Please log in to view your clients.')
      return
    }
    fetchJobs()
  }, [currentUser, fetchJobs])

  const clients = useMemo(() => buildClients(jobs), [jobs])
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()

  const filteredClients = useMemo(() => {
    if (!normalizedSearchTerm) return clients

    return clients.filter((client) =>
      [client.name, client.phone, client.address].some((value) =>
        (value ?? '').toLowerCase().includes(normalizedSearchTerm)
      )
    )
  }, [clients, normalizedSearchTerm])

  const selectedClient = filteredClients.find((client) => client.id === activeClientId)

  const containerClasses = ['clients-page']
  if (!selectedClient) {
    containerClasses.push('clients-page--no-selection')
  }

  const closeEditModal = () => {
    setEditingJob(null)
    setEditError('')
  }

  const applyJobUpdate = (jobId, updates) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== jobId) return job
        return {
          ...job,
          ...updates,
          payment:
            updates.payment !== undefined
              ? Number(updates.payment).toFixed(2)
              : job.payment,
          comments:
            updates.comments !== undefined
              ? updates.comments || null
              : job.comments
        }
      })
    )
  }

  const saveJobEdits = async (updates) => {
    if (!editingJob) return

    setIsSavingJob(true)
    setEditError('')

    try {
      const res = await fetchWithAuth(`/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || payload.errors?.[0]?.msg || 'Failed to update job')
      }

      applyJobUpdate(editingJob.id, {
        name: updates.name,
        phone: updates.phone,
        address: updates.address,
        job_type: updates.jobType,
        job_date: updates.jobDate,
        start_time: updates.startTime,
        status: updates.status,
        payment: updates.payment,
        comments: updates.comments
      })
      closeEditModal()
    } catch (err) {
      console.error('Error updating job from clients page:', err)
      setEditError(err.message || 'Unable to update job')
    } finally {
      setIsSavingJob(false)
    }
  }

  return (
    <div className={containerClasses.join(' ')}>
      <section className="clients-section">
        <div>
          <h3>Clients</h3>
          <p>Browse every customer record created from your appointment history.</p>
        </div>

        {!loading && !error && clients.length > 0 && (
          <div className="clients-search">
            <label className="clients-search-label" htmlFor="client-search">
              Search clients
            </label>
            <input
              id="client-search"
              type="search"
              className="clients-search-input"
              placeholder="Search by name, phone, or address"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {loading ? (
          <p>Loading clients...</p>
        ) : error ? (
          <p className="clients-error">{error}</p>
        ) : clients.length === 0 ? (
          <p>No clients have jobs yet.</p>
        ) : filteredClients.length === 0 ? (
          <p>No clients match your search.</p>
        ) : (
          <div className="clients-list">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className={`client-card ${
                  activeClientId === client.id
                    ? 'client-card--active'
                    : 'client-card--inactive'
                }`}
                onClick={() => setActiveClientId(client.id)}
              >
                <div>
                  <p className="client-name">{client.name}</p>
                  <p className="client-meta">
                    {client.phone} | {client.address}
                  </p>
                  <p className="client-payment-total">
                    Total paid: {formatCurrency(client.totalPayments)}
                  </p>
                </div>
                <button
                  type="button"
                  className="client-card-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveClientId(client.id)
                  }}
                >
                  View jobs
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        className={`client-jobs-section${
          selectedClient ? ' client-jobs-section--selected' : ''
        }`}
      >
        <div className="client-jobs-header">
          <div>
            <h3>Jobs for {selectedClient ? selectedClient.name : 'clients'}</h3>
            <p>
              {selectedClient
                ? 'Review the latest appointments and notes for the selected client.'
                : 'Choose a client on the left to load their appointment history.'}
            </p>
          </div>
          {selectedClient && (
            <div className="client-jobs-summary">
              <span className="client-jobs-count">
                {selectedClient.jobs.length} job
                {selectedClient.jobs.length === 1 ? '' : 's'}
              </span>
              <strong className="client-payment-total client-payment-total--selected">
                Total paid: {formatCurrency(selectedClient.totalPayments)}
              </strong>
            </div>
          )}
        </div>

        {!selectedClient ? (
          <p>Select a client to surface their jobs.</p>
        ) : selectedClient.jobs.length === 0 ? (
          <p>No jobs found for this client.</p>
        ) : (
          <div className="client-jobs-table-wrap">
            <table className="client-jobs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Job Type</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Comments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedClient.jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{formatDate(job.job_date)}</td>
                    <td>{formatTimeRange(job.start_time)}</td>
                    <td>{job.job_type}</td>
                    <td>{job.status}</td>
                    <td>{formatCurrency(job.payment)}</td>
                    <td>{job.comments || 'No notes yet'}</td>
                    <td>
                      <button
                        type="button"
                        className="comments-button"
                        onClick={() => {
                          setEditingJob(job)
                          setEditError('')
                        }}
                      >
                        Edit job
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <JobEditorModal
        key={editingJob?.id || 'clients-editor'}
        job={editingJob}
        clients={clients}
        saving={isSavingJob}
        error={editError}
        onClose={closeEditModal}
        onSave={saveJobEdits}
      />
    </div>
  )
}
