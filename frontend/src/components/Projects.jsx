import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export function Projects() {
  const [projects, setProjects] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [annotatorUsers, setAnnotatorUsers] = useState([])
  const [reviewerUsers, setReviewerUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    workspace_id: '',
    status: '',
    profile_type: '',
    name_contains: '',
    annotator_id: '',
    reviewer_id: '',
  })
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api('/users/by-role?role=annotator').then((r) => (Array.isArray(r) ? r : [])).catch(() => []),
      api('/users/by-role?role=reviewer').then((r) => (Array.isArray(r) ? r : [])).catch(() => []),
    ]).then(([a, r]) => {
      setAnnotatorUsers(a)
      setReviewerUsers(r)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const q = {}
        if (filters.workspace_id) q.workspace_id = filters.workspace_id
        if (filters.status) q.status = filters.status
        if (filters.profile_type) q.profile_type = filters.profile_type
        if (filters.name_contains) q.name_contains = filters.name_contains
        const query = Object.keys(q).length ? '?' + new URLSearchParams(q).toString() : ''
        const [projList, wsList] = await Promise.all([
          api('/projects' + query),
          api('/workspaces'),
        ])
        if (!cancelled) {
          setProjects(Array.isArray(projList) ? projList : [])
          setWorkspaces(Array.isArray(wsList) ? wsList : [])
        }
      } catch {
        if (!cancelled) setProjects([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filters.workspace_id, filters.status, filters.profile_type, filters.name_contains])

  const clearFilters = () => setFilters({ workspace_id: '', status: '', profile_type: '', name_contains: '', annotator_id: '', reviewer_id: '' })
  const hasFilters = filters.workspace_id || filters.status || filters.profile_type || filters.name_contains || filters.annotator_id || filters.reviewer_id

  const displayedProjects = useMemo(() => {
    let list = projects
    const aid = filters.annotator_id ? parseInt(filters.annotator_id, 10) : null
    const rid = filters.reviewer_id ? parseInt(filters.reviewer_id, 10) : null
    if (aid) list = list.filter((p) => (p.annotator_ids || []).includes(aid))
    if (rid) list = list.filter((p) => (p.reviewer_ids || []).includes(rid))
    return list
  }, [projects, filters.annotator_id, filters.reviewer_id])

  const userDisplay = (u) => (u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '').trim() || u.email

  return (
    <>
      <div className="list-page">
        <aside className="list-filter-panel">
          <h3>
            FILTER BY
            {hasFilters && (
              <button type="button" className="filter-clear" onClick={clearFilters}>Clear All</button>
            )}
          </h3>
          <div className="filter-section">
            <label>Project name</label>
            <input
              type="text"
              placeholder="Type project name…"
              value={filters.name_contains}
              onChange={(e) => setFilters((f) => ({ ...f, name_contains: e.target.value }))}
            />
          </div>
          <div className="filter-section">
            <label>Workspace</label>
            <select
              value={filters.workspace_id}
              onChange={(e) => setFilters((f) => ({ ...f, workspace_id: e.target.value }))}
            >
              <option value="">All workspaces</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-section">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="filter-section">
            <label>Profile type</label>
            <select
              value={filters.profile_type}
              onChange={(e) => setFilters((f) => ({ ...f, profile_type: e.target.value }))}
            >
              <option value="">All profile types</option>
              <option value="parent">Parent</option>
              <option value="annotator">Annotator</option>
              <option value="review">Review</option>
              <option value="reassignment">Reassignment</option>
            </select>
          </div>
          <div className="filter-section">
            <label>Annotator</label>
            <select
              value={filters.annotator_id}
              onChange={(e) => setFilters((f) => ({ ...f, annotator_id: e.target.value }))}
            >
              <option value="">All</option>
              {annotatorUsers.map((u) => (
                <option key={u.id} value={u.id}>{userDisplay(u)}</option>
              ))}
            </select>
          </div>
          <div className="filter-section">
            <label>Reviewer</label>
            <select
              value={filters.reviewer_id}
              onChange={(e) => setFilters((f) => ({ ...f, reviewer_id: e.target.value }))}
            >
              <option value="">All</option>
              {reviewerUsers.map((u) => (
                <option key={u.id} value={u.id}>{userDisplay(u)}</option>
              ))}
            </select>
          </div>
        </aside>

        <div className="list-content">
          <div className="list-header">
            <h1 className="list-title">Project list</h1>
            <span className="list-results">{displayedProjects.length} result{displayedProjects.length !== 1 ? 's' : ''}</span>
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
                    <th>Project name</th>
                    <th>Project ID</th>
                    <th>Status</th>
                    <th>Profile type</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        No projects match the filters.
                      </td>
                    </tr>
                  ) : (
                    displayedProjects.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <button
                            type="button"
                            className="link"
                            onClick={() => navigate(`/projects/${p.id}`)}
                          >
                            {p.name}
                          </button>
                        </td>
                        <td>{p.external_id || `PRJ-${p.id}`}</td>
                        <td>
                          <span className={`status-badge ${p.status === 'completed' ? 'completed' : p.status === 'active' ? 'in_progress' : 'pending'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>{p.profile_type}</td>
                        <td>{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</td>
                        <td>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${p.id}/flow`)}>Flow</button>
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
    </>
  )
}
