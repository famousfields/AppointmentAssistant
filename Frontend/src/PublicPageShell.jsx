export default function PublicPageShell({ eyebrow, title, description, children }) {
  return (
    <section className="public-page-shell">
      <div className="public-page-card">
        <div className="public-page-hero">
          {eyebrow ? <p className="public-page-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p className="public-page-description">{description}</p> : null}
        </div>
        <div className="public-page-body">{children}</div>
      </div>
    </section>
  )
}
