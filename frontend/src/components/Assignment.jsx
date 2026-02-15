import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export function Assignment() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api('/projects/my-assignments')
      .then((list) => setAssignments(Array.isArray(list) ? list : []))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="list-page">
      <div className="list-content">
        <div className="list-header">
          <h1 className="list-title">My assignments</h1>
          <span className="list-results">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</span>
        </div>
        <p className="page-desc">Projects where you are assigned as annotator or reviewer, with your share (%) and ETA.</p>
        {loading ? (
          <div className="loader">
            <div className="spinner" />
            <p>Loading…</p>
          </div>
        ) : assignments.length === 0 ? (
          <p className="empty">No assignments yet. Ops will assign you to projects from Create → Assign Annotators / Assign Reviewers.</p>
        ) : (
          <div className="list-table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Role</th>
                  <th>% of tasks</th>
                  <th>ETA (days)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a, idx) => (
                  <tr key={`${a.project_id}-${a.role}-${idx}`}>
                    <td>
                      <button type="button" className="link" onClick={() => navigate(`/projects/${a.project_id}`)}>
                        {a.project_name}
                      </button>
                      {a.external_id && <span className="meta" style={{ marginLeft: '0.5rem' }}>{a.external_id}</span>}
                    </td>
                    <td><span className="badge badge-role">{a.role}</span></td>
                    <td>{a.percent != null ? `${Number(a.percent)}%` : '—'}</td>
                    <td>{a.eta_days != null ? `${a.eta_days} days` : '—'}</td>
                    <td>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/workqueue')}>
                        Open workqueue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
