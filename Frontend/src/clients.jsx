import { useEffect, useMemo, useState } from 'react'

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const buildClients = (jobs) => {
  const map = new Map()

  jobs.forEach((job) => {
    const clientId = job.client_id ?? `${job.name}|${job.phone}|${job.address}`
    if (!map.has(clientId)) {
      map.set(clientId, {
        id: clientId,
        name: job.name,
        phone: job.phone,
        address: job.address,
        jobs: []
      })
    }
    map.get(clientId).jobs.push(job)
  })

  return Array.from(map.values())
    .map((client) => {
      const sortedJobs = [...client.jobs].sort(
        (a, b) => new Date(b.job_date) - new Date(a.job_date)
      )
      return { ...client, jobs: sortedJobs }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export default function ClientsList({ currentUser }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeClientId, setActiveClientId] = useState('')

  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      setJobs([])
      setError('Please log in to view your clients.')
      return
    }
    fetchJobs()
  }, [currentUser])

  const fetchJobs = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`http://localhost:5000/jobs?userId=${encodeURIComponent(currentUser?.id)}`)
      if (!res.ok) throw new Error('Unable to load jobs')
      const data = await res.json()
      setJobs(data)
    } catch (err) {
      console.error('Failed fetching jobs:', err)
      setError("We couldn't load client data right now.")
    } finally {
      setLoading(false)
    }
  }

  const clients = useMemo(() => buildClients(jobs), [jobs])

  const selectedClient = clients.find((client) => client.id === activeClientId)

  const containerClasses = ['clients-page']
  if (!selectedClient) {
    containerClasses.push('clients-page--no-selection')
  }

  return (
    <div className={containerClasses.join(' ')}>
      <section className="clients-section">
        <div>
          <h3>Clients</h3>
          <p>Browse every customer record created from your appointment history.</p>
        </div>

        {loading ? (
          <p>Loading clients...</p>
        ) : error ? (
          <p className="clients-error">{error}</p>
        ) : clients.length === 0 ? (
          <p>No clients have jobs yet.</p>
        ) : (
          <div className="clients-list">
            {clients.map((client) => (
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
            <span className="client-jobs-count">
              {selectedClient.jobs.length} job
              {selectedClient.jobs.length === 1 ? '' : 's'}
            </span>
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
                  <th>Job Type</th>
                  <th>Status</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {selectedClient.jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{formatDate(job.job_date)}</td>
                    <td>{job.job_type}</td>
                    <td>{job.status}</td>
                    <td>{job.comments || 'No notes yet'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
