import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export function TaskList() {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [batchMap, setBatchMap] = useState({})
  const [projectMap, setProjectMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    project_id: '',
    batch_id: '',
    status: '',
    pipeline_stage: '',
    claimed_by_id: '',
    assigned_reviewer_id: '',
  })
  const [annotatorUsers, setAnnotatorUsers] = useState([])
  const [reviewerUsers, setReviewerUsers] = useState([])
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
        const params = new URLSearchParams()
        if (filters.project_id) params.set('project_id', filters.project_id)
        if (filters.batch_id) params.set('batch_id', filters.batch_id)
        if (filters.status) params.set('status', filters.status)
        if (filters.pipeline_stage) params.set('pipeline_stage', filters.pipeline_stage)
        if (filters.claimed_by_id) params.set('claimed_by_id', filters.claimed_by_id)
        if (filters.assigned_reviewer_id) params.set('assigned_reviewer_id', filters.assigned_reviewer_id)
        const taskList = await api('/tasks?' + params.toString())
        const list = Array.isArray(taskList) ? taskList : []
        if (cancelled) return

        const batchIds = [...new Set(list.map((t) => t.batch_id))]
        const batches = await Promise.all(batchIds.map((id) => api(`/batches/${id}`).catch(() => null)))
        if (cancelled) return
        const bMap = {}
        batches.forEach((b) => { if (b) bMap[b.id] = b })
        setBatchMap(bMap)

        const projectIds = [...new Set(Object.values(bMap).map((b) => b.project_id).filter(Boolean))]
        const projs = await Promise.all(projectIds.map((id) => api(`/projects/${id}`).catch(() => null)))
        if (cancelled) return
        const pMap = {}
        projs.forEach((p) => { if (p) pMap[p.id] = p })
        setProjectMap(pMap)

        setTasks(list)
      } catch {
        if (!cancelled) setTasks([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filters.project_id, filters.batch_id, filters.status, filters.pipeline_stage, filters.claimed_by_id, filters.assigned_reviewer_id])

  useEffect(() => {
    api('/projects').then((p) => setProjects(Array.isArray(p) ? p : [])).catch(() => setProjects([]))
  }, [])

  const clearFilters = () => setFilters({ project_id: '', batch_id: '', status: '', pipeline_stage: '', claimed_by_id: '', assigned_reviewer_id: '' })
  const hasFilters = filters.project_id || filters.batch_id || filters.status || filters.pipeline_stage || filters.claimed_by_id || filters.assigned_reviewer_id
  const userDisplay = (u) => (u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '').trim() || u.email

  const taskDisplayName = (t) => {
    const c = t.content || {}
    if (c.text) return String(c.text).slice(0, 60) + (String(c.text).length > 60 ? '…' : '')
    if (c.file) return c.file
    return `Task #${t.id}`
  }

  const statusBadgeClass = (status) => {
    if (status === 'completed') return 'completed'
    if (status === 'in_progress') return 'in_progress'
    if (status === 'obsolete' || status === 'cancelled') return 'obsolete'
    return 'pending'
  }

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
            <label>Project</label>
            <select
              value={filters.project_id}
              onChange={(e) => setFilters((f) => ({ ...f, project_id: e.target.value }))}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
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
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="filter-section">
            <label>Pipeline stage</label>
            <select
              value={filters.pipeline_stage}
              onChange={(e) => setFilters((f) => ({ ...f, pipeline_stage: e.target.value }))}
            >
              <option value="">All stages</option>
              <option value="L1">L1</option>
              <option value="Review">Review</option>
              <option value="Done">Done</option>
            </select>
          </div>
          <div className="filter-section">
            <label>Batch ID</label>
            <input
              type="text"
              placeholder="Batch ID (number)"
              value={filters.batch_id}
              onChange={(e) => setFilters((f) => ({ ...f, batch_id: e.target.value.replace(/\D/g, '') }))}
            />
          </div>
          <div className="filter-section">
            <label>Annotator</label>
            <select
              value={filters.claimed_by_id}
              onChange={(e) => setFilters((f) => ({ ...f, claimed_by_id: e.target.value }))}
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
              value={filters.assigned_reviewer_id}
              onChange={(e) => setFilters((f) => ({ ...f, assigned_reviewer_id: e.target.value }))}
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
            <h1 className="list-title">Task list</h1>
            <span className="list-results">{tasks.length} result{tasks.length !== 1 ? 's' : ''}</span>
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
                    <th>Task</th>
                    <th>Status</th>
                    <th>Project name</th>
                    <th>Batch</th>
                    <th>Pipeline stage</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        No tasks match the filters.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((t) => {
                      const batch = batchMap[t.batch_id]
                      const project = batch ? projectMap[batch.project_id] : null
                      return (
                        <tr key={t.id}>
                          <td>
                            <button
                              type="button"
                              className="link"
                              onClick={() => batch && project && navigate(`/projects/${project.id}`)}
                            >
                              {taskDisplayName(t)}
                            </button>
                          </td>
                          <td>
                            <span className={`status-badge ${statusBadgeClass(t.status)}`}>
                              {t.status}
                            </span>
                          </td>
                          <td>
                            {project ? (
                              <button
                                type="button"
                                className="link"
                                onClick={() => navigate(`/projects/${project.id}`)}
                              >
                                {project.name}
                              </button>
                            ) : '—'}
                          </td>
                          <td>{batch ? batch.name : t.batch_id}</td>
                          <td>{t.pipeline_stage}</td>
                          <td>{t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}</td>
                          <td>
                            {project && (
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${project.id}`)}>Open</button>
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
    </>
  )
}
