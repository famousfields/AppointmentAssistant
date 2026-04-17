import { buildClientSuggestions, formatPhonePreview } from './clientUtils'

export default function ClientSuggestions({ clients, query, field, visible, onSelect }) {
  const matches = visible ? buildClientSuggestions(clients, query, field).slice(0, 6) : []

  if (!visible || matches.length === 0) return null

  return (
    <div className="client-suggestions" role="listbox" aria-label="Client suggestions">
      {matches.map((client, index) => (
        <button
          key={client.id ?? `${client.name || 'client'}-${client.phone || ''}-${client.address || ''}-${index}`}
          type="button"
          className={`client-suggestion${index === matches.length - 1 ? ' client-suggestion--last' : ''}`}
          onClick={() => onSelect(client)}
        >
          <span className="client-suggestion__name">{client.name || 'No name'}</span>
          <span className="client-suggestion__meta">{formatPhonePreview(client.phone)}</span>
          <span className="client-suggestion__meta">{client.address || 'No address'}</span>
        </button>
      ))}
    </div>
  )
}
