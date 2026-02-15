import { useState, useEffect } from 'react'
import { api } from '../api'

export function Insight() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api('/insight/stats')
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load insight')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner" />
        <p>Loading insight…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card">
        <p className="meta" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    )
  }

  const projects = stats?.projects ?? { total: 0, by_status: {} }
  const tasks = stats?.tasks ?? { total: 0, by_status: {} }

  return (
    <>
      <h1 className="page-title">Insight</h1>
      <p className="page-desc">Overview of projects and tasks by status.</p>

      <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--table-border)' }}>
          <div className="data-insight-stat">
            <span className="data-insight-value">{projects.total}</span>
            <span className="data-insight-label">Total projects</span>
          </div>
        </div>
        {Object.entries(projects.by_status).map(([status, count]) => (
          <div key={status} className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent)' }}>
            <div className="data-insight-stat">
              <span className="data-insight-value">{count}</span>
              <span className="data-insight-label">Projects · {status}</span>
            </div>
          </div>
        ))}
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--table-border)' }}>
          <div className="data-insight-stat">
            <span className="data-insight-value">{tasks.total}</span>
            <span className="data-insight-label">Total tasks</span>
          </div>
        </div>
        {Object.entries(tasks.by_status).map(([status, count]) => (
          <div key={status} className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent)' }}>
            <div className="data-insight-stat">
              <span className="data-insight-value">{count}</span>
              <span className="data-insight-label">Tasks · {status}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
