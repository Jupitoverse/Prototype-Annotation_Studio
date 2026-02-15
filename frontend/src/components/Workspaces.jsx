import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export function Workspaces() {
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', name_contains: '' })
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const list = await api('/workspaces')
        if (!cancelled) setWorkspaces(Array.isArray(list) ? list : [])
      } catch {
        if (!cancelled) setWorkspaces([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const clearFilters = () => setFilters({ status: '', name_contains: '' })
  const hasFilters = filters.status || filters.name_contains
  const filtered = workspaces.filter((w) => {
    if (filters.status && (w.status || '') !== filters.status) return false
    if (filters.name_contains) {
      const q = filters.name_contains.toLowerCase()
      if (!(w.name || '').toLowerCase().includes(q) && !(w.description || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="list-page">
      <aside className="list-filter-panel">
        <h3>
          FILTER BY
          {hasFilters && (
            <button type="button" className="filter-clear" onClick={clearFilters}>Clear All</button>
          )}
        </h3>
        <div className="filter-section">
          <label>Workspace name</label>
          <input
            type="text"
            placeholder="Search name or description…"
            value={filters.name_contains}
            onChange={(e) => setFilters((f) => ({ ...f, name_contains: e.target.value }))}
          />
        </div>
        <div className="filter-section">
          <label>Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </aside>
      <div className="list-content">
        <div className="list-header">
          <h1 className="list-title">Workspaces</h1>
          <span className="list-results">{filtered.length} workspace{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="loader">
            <div className="spinner" />
            <p>Loading…</p>
          </div>
        ) : (
          <div className="list-table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Total projects</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="list-empty-cell">No workspaces found.</td>
                  </tr>
                ) : (
                  filtered.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <button type="button" className="link" onClick={() => navigate(`/projects?workspace_id=${w.id}`)}>
                          {w.name}
                        </button>
                      </td>
                      <td>{(w.description || '').slice(0, 60)}{(w.description || '').length > 60 ? '…' : ''}</td>
                      <td>{w.total_projects ?? 0}</td>
                      <td>
                        <span className={`status-badge ${w.status === 'active' ? 'in_progress' : 'pending'}`}>
                          {w.status || '—'}
                        </span>
                      </td>
                      <td>{w.created_at ? new Date(w.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects?workspace_id=${w.id}`)}>
                          View projects
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
