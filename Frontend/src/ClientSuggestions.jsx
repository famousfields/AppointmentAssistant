import { buildClientSuggestions, formatPhonePreview } from './clientUtils'

export default function ClientSuggestions({
  clients,
  query,
  field,
  visible,
  onSelect,
  onCreateNew,
  createLabel = 'Create new client'
}) {
  const matches = visible ? buildClientSuggestions(clients, query, field).slice(0, 6) : []
  const hasQuery = String(query || '').trim().length > 0

  if (!visible || (!hasQuery && matches.length === 0)) return null

  return (
    <div className="client-suggestions" role="listbox" aria-label="Client suggestions">
      <div className="client-suggestions__header">
        <div>
          <strong>Client matches</strong>
          <span>Select an existing client or keep your new entry.</span>
        </div>
        {hasQuery && onCreateNew ? (
          <button
            type="button"
            className="client-suggestions__create"
            onClick={onCreateNew}
          >
            {createLabel}
          </button>
        ) : null}
      </div>
      {matches.length === 0 ? (
        <div className="client-suggestions__empty">
          No close matches yet. Continue with this as a new client.
        </div>
      ) : null}
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
