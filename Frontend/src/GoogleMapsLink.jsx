const buildGoogleMapsUrl = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address || '').trim())}`

function MapIcon() {
  return (
    <svg className="maps-link-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 6.5 9 4l6 2 5-2v14l-5 2-6-2-5 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 4v14M15 6v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function GoogleMapsLink({ address, className = '', label = 'Open in Google Maps' }) {
  const trimmedAddress = String(address || '').trim()

  if (!trimmedAddress) return null

  const href = buildGoogleMapsUrl(trimmedAddress)

  return (
    <a
      className={`maps-link-button${className ? ` ${className}` : ''}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label}: ${trimmedAddress}`}
      title={trimmedAddress}
    >
      <MapIcon />
      <span>{label}</span>
    </a>
  )
}
