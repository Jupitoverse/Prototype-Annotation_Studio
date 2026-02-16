import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const STATUS_COLORS = {
  pending: { bg: '#fef9c3', border: '#ca8a04', label: 'Pending' },
  approved: { bg: '#dcfce7', border: '#16a34a', label: 'Approved' },
  rejected: { bg: '#fee2e2', border: '#dc2626', label: 'Rejected' },
}

function userDisplay(u) {
  if (!u) return '—'
  return (u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '').trim() || u.email
}

export function Requests({ user, canOps, canAnnotator }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', requested_by_id: '', project_id: '' })

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.requested_by_id) params.set('requested_by_id', filters.requested_by_id)
    if (filters.project_id) params.set('project_id', filters.project_id)
    api(`/requests?${params.toString()}`)
      .then((r) => { if (!cancelled) setRequests(Array.isArray(r) ? r : []) })
      .catch(() => { if (!cancelled) setRequests([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters.status, filters.requested_by_id, filters.project_id])

  useEffect(() => {
    if (!canOps) return
    Promise.all([
      api('/users/by-role?role=annotator').catch(() => []),
      api('/projects').catch(() => []),
    ]).then(([u, p]) => {
      setUsers(Array.isArray(u) ? u : [])
      setProjects(Array.isArray(p) ? p : [])
    })
  }, [canOps])

  const handleApprove = async (requestId) => {
    try {
      await api(`/requests/claim/${requestId}/approve`, { method: 'POST' })
      setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'approved' } : r))
    } catch (e) {
      console.error(e)
    }
  }
  const handleReject = async (requestId) => {
    try {
      await api(`/requests/claim/${requestId}/reject`, { method: 'POST' })
      setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'rejected' } : r))
    } catch (e) {
      console.error(e)
    }
  }

  const canAct = (r) => r.status === 'pending' && (r.current_assignee_id === user?.id || canOps)

  return (
    <div className="page-container">
      <h1 className="page-title">Requests</h1>
      <p className="page-desc">Task claim requests: annotators request to take a task from someone else. One approval (assignee or Ops/Admin) fulfills the request.</p>

      <div className="section">
        <div className="card">
          <h3>Filters</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="filter-section">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            {canOps && (
              <>
                <div className="filter-section">
                  <label>Requested by</label>
                  <select
                    value={filters.requested_by_id}
                    onChange={(e) => setFilters((f) => ({ ...f, requested_by_id: e.target.value }))}
                  >
                    <option value="">All</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{userDisplay(u)}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-section">
                  <label>Project</label>
                  <select
                    value={filters.project_id}
                    onChange={(e) => setFilters((f) => ({ ...f, project_id: e.target.value }))}
                  >
                    <option value="">All</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Claim requests</h3>
          {loading ? (
            <div className="loader"><div className="spinner" /><p>Loading…</p></div>
          ) : (
            <div className="list-table-wrap">
              <table className="list-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Task ID</th>
                    <th>Requested by</th>
                    <th>Current assignee</th>
                    <th>Status</th>
                    <th>Created</th>
                    {canOps && <th>Approved/Rejected by</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={canOps ? 8 : 7} className="list-empty-cell">No requests match filters.</td>
                    </tr>
                  ) : (
                    requests.map((r) => {
                      const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending
                      return (
                        <tr key={r.id} style={{ background: sc.bg, borderLeft: `3px solid ${sc.border}` }}>
                          <td>{r.id}</td>
                          <td>
                            <button type="button" className="link" onClick={() => navigate('/workqueue')}>Task #{r.task_id}</button>
                          </td>
                          <td>{r.requested_by_email || `User #${r.requested_by_id}`}</td>
                          <td>{r.current_assignee_email || (r.current_assignee_id ? `User #${r.current_assignee_id}` : '—')}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: sc.border }}>{sc.label}</span>
                          </td>
                          <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                          {canOps && <td>{r.approved_by_email || (r.approved_by_id ? `User #${r.approved_by_id}` : '—')}</td>}
                          <td>
                            {canAct(r) && (
                              <span style={{ display: 'flex', gap: '0.35rem' }}>
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleApprove(r.id)}>Approve</button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleReject(r.id)}>Reject</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
