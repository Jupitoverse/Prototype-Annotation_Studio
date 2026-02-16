import { useState, useEffect } from 'react'
import { api } from '../api'

function BarChart({ data, labelKey = 'label', valueKey = 'value', maxBars = 8, color = 'var(--accent)' }) {
  const maxVal = Math.max(...data.map((d) => d[valueKey]), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {data.slice(0, maxBars).map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ flex: '0 0 100px', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d[labelKey]}>
            {d[labelKey]}
          </span>
          <div style={{ flex: 1, height: 20, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(d[valueKey] / maxVal) * 100}%`,
                height: '100%',
                background: color,
                borderRadius: 4,
                minWidth: d[valueKey] > 0 ? 4 : 0,
              }}
            />
          </div>
          <span style={{ flex: '0 0 2rem', fontSize: '0.85rem', textAlign: 'right' }}>{d[valueKey]}</span>
        </div>
      ))}
    </div>
  )
}

export function Insight() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [projectProgress, setProjectProgress] = useState([])

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

  useEffect(() => {
    api('/insight/project-progress')
      .then((data) => setProjectProgress(data?.projects ?? []))
      .catch(() => setProjectProgress([]))
  }, [])

  useEffect(() => {
    api('/projects').then((p) => setProjects(Array.isArray(p) ? p : [])).catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    if (!selectedProjectId) {
      setReport(null)
      return
    }
    setReportLoading(true)
    api(`/insight/project/${selectedProjectId}/annotator-report`)
      .then((data) => setReport(data))
      .catch(() => setReport(null))
      .finally(() => setReportLoading(false))
  }, [selectedProjectId])

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

  const workspaces = stats?.workspaces ?? { total: 0 }
  const projectsStats = stats?.projects ?? { total: 0, by_status: {} }
  const tasksStats = stats?.tasks ?? { total: 0, by_status: {} }
  const usersStats = stats?.users ?? { total: 0, by_role: {} }
  const annotators = report?.annotators ?? []

  const projectStatusBars = Object.entries(projectsStats.by_status).map(([label, value]) => ({ label: `Projects · ${label}`, value }))
  const taskStatusBars = Object.entries(tasksStats.by_status).map(([label, value]) => ({ label: `Tasks · ${label}`, value }))
  const userRoleBars = Object.entries(usersStats.by_role).map(([label, value]) => ({ label, value }))

  return (
    <>
      <h1 className="page-title">Insight</h1>
      <p className="page-desc">Overview of workspaces, projects, users, and tasks. View per-project annotator report below.</p>

      {/* Summary cards */}
      <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{workspaces.total}</div>
          <div className="data-insight-label">Workspaces</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-secondary)' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{projectsStats.total}</div>
          <div className="data-insight-label">Projects</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--success-color)' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{usersStats.total}</div>
          <div className="data-insight-label">Users</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--table-border)' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{tasksStats.total}</div>
          <div className="data-insight-label">Tasks</div>
        </div>
      </div>

      {/* Graphical view: bars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Projects by status</h3>
          {projectStatusBars.length === 0 ? (
            <p className="meta">No project status data.</p>
          ) : (
            <BarChart data={projectStatusBars} valueKey="value" labelKey="label" color="var(--accent)" />
          )}
        </div>
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Users by role</h3>
          {userRoleBars.length === 0 ? (
            <p className="meta">No user role data.</p>
          ) : (
            <BarChart data={userRoleBars} valueKey="value" labelKey="label" color="var(--accent-secondary)" />
          )}
        </div>
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Tasks by status</h3>
          {taskStatusBars.length === 0 ? (
            <p className="meta">No task status data.</p>
          ) : (
            <BarChart data={taskStatusBars} valueKey="value" labelKey="label" color="var(--success-color)" />
          )}
        </div>
      </div>

      {/* Project progress report */}
      <div className="card" style={{ marginTop: '2rem', padding: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Project progress</h3>
        <p className="meta" style={{ marginBottom: '1rem' }}>Completion per project (completed tasks / total tasks).</p>
        {projectProgress.length === 0 ? (
          <p className="meta">No projects yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {projectProgress.map((p) => (
              <div key={p.project_id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                  <span>{p.project_name}</span>
                  <span>{p.completed_tasks} / {p.total_tasks} tasks · {p.status}</span>
                </div>
                <div style={{ height: 10, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${p.total_tasks ? (p.completed_tasks / p.total_tasks) * 100 : 0}%`,
                      height: '100%',
                      background: p.status === 'ready_for_export' ? 'var(--success-color)' : 'var(--accent)',
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Annotator report by project */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginTop: 0 }}>Annotator report by project</h3>
        <p className="meta">Select a project to see annotator statistics.</p>
        <label className="form-label">Project</label>
        <select
          className="form-input"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          style={{ maxWidth: 360 }}
        >
          <option value="">— Select project —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {reportLoading && (
          <div className="loader" style={{ minHeight: 120, marginTop: '1rem' }}>
            <div className="spinner" />
            <p>Loading report…</p>
          </div>
        )}

        {!reportLoading && selectedProjectId && report && (
          <div className="list-table-wrap" style={{ marginTop: '1.25rem', overflow: 'auto' }}>
            {annotators.length === 0 ? (
              <p className="meta">No annotators assigned to this project or no task data yet.</p>
            ) : (
              <table className="list-table insight-annotator-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Annotator</th>
                    <th>Email</th>
                    <th>Assigned</th>
                    <th>Accepted</th>
                    <th>Unlabeled</th>
                    <th>Skipped</th>
                    <th>Draft</th>
                    <th>Word count</th>
                    <th>Avg time (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {annotators.map((row, i) => (
                    <tr key={row.user_id} style={{ background: i % 2 === 0 ? 'rgba(59, 130, 246, 0.08)' : 'rgba(34, 197, 94, 0.08)' }}>
                      <td>{row.annotator || '—'}</td>
                      <td>{row.email || '—'}</td>
                      <td>{row.assigned_tasks ?? 0}</td>
                      <td>{row.accepted_tasks ?? 0}</td>
                      <td>{row.unlabeled_tasks ?? 0}</td>
                      <td>{row.skipped_tasks ?? 0}</td>
                      <td>{row.draft_tasks ?? 0}</td>
                      <td>{row.word_count ?? 0}</td>
                      <td>{row.average_annotation_time_seconds != null ? Number(row.average_annotation_time_seconds).toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  )
}
