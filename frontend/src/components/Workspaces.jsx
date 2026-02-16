import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export function Workspaces() {
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', name_contains: '' })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')
  const navigate = useNavigate()

  const loadWorkspaces = () => {
    api('/workspaces')
      .then((list) => setWorkspaces(Array.isArray(list) ? list : []))
      .catch(() => setWorkspaces([]))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api('/workspaces')
      .then((list) => { if (!cancelled) setWorkspaces(Array.isArray(list) ? list : []) })
      .catch(() => { if (!cancelled) setWorkspaces([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
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

  const downloadCsv = () => {
    const headers = ['ID', 'Name', 'Description', 'Status']
    const rows = filtered.map((w) => [w.id, w.name ?? '', w.description ?? '', w.status ?? ''])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workspaces-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
        <div className="list-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="list-title">Workspaces</h1>
            <span className="list-results">{filtered.length} workspace{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={downloadCsv} disabled={filtered.length === 0}>Download CSV</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateForm(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              title="Create new workspace"
            >
              <span aria-hidden style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
              New workspace
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Create workspace</h3>
            {createError && <p className="meta" style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>{createError}</p>}
            <label className="form-label">Name</label>
            <input
              className="form-input"
              value={createName}
              onChange={(e) => { setCreateName(e.target.value); setCreateError('') }}
              placeholder="Workspace name"
              style={{ marginBottom: '0.75rem' }}
            />
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Short description (optional)"
              rows={2}
              style={{ marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!createName.trim() || createSubmitting}
                onClick={async () => {
                  setCreateError('')
                  setCreateSubmitting(true)
                  try {
                    await api('/workspaces', {
                      method: 'POST',
                      body: JSON.stringify({ name: createName.trim(), description: createDescription.trim() || '' }),
                    })
                    setShowCreateForm(false)
                    setCreateName('')
                    setCreateDescription('')
                    loadWorkspaces()
                  } catch (e) {
                    setCreateError(e?.message || 'Failed to create workspace')
                  } finally {
                    setCreateSubmitting(false)
                  }
                }}
              >
                {createSubmitting ? 'Creating…' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowCreateForm(false); setCreateError(''); setCreateName(''); setCreateDescription('') }}>
                Cancel
              </button>
            </div>
          </div>
        )}
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
