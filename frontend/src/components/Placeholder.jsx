export function Placeholder({ title, description, children }) {
  return (
    <>
      <h1 className="page-title">{title}</h1>
      <p className="page-desc">{description ?? 'This section is coming soon.'}</p>
      {children ?? (
        <div className="card" style={{ maxWidth: '480px' }}>
          <p className="empty">This feature will be implemented in the next phase.</p>
        </div>
      )}
    </>
  )
}
