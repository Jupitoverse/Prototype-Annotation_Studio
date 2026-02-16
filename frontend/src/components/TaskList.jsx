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
    workspace_id: '',
    status: '',
    pipeline_stage: '',
    claimed_by_id: '',
    assigned_reviewer_id: '',
    date_from: '',
    date_to: '',
    search: '',
  })
  const [workspaces, setWorkspaces] = useState([])
  const [annotatorUsers, setAnnotatorUsers] = useState([])
  const [reviewerUsers, setReviewerUsers] = useState([])
  const [claimingId, setClaimingId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api('/users/by-role?role=annotator').then((r) => (Array.isArray(r) ? r : [])).catch(() => []),
      api('/users/by-role?role=reviewer').then((r) => (Array.isArray(r) ? r : [])).catch(() => []),
      api('/workspaces').then((r) => (Array.isArray(r) ? r : [])).catch(() => []),
    ]).then(([a, r, w]) => {
      setAnnotatorUsers(a)
      setReviewerUsers(r)
      setWorkspaces(w || [])
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
        if (filters.workspace_id) params.set('workspace_id', filters.workspace_id)
        if (filters.date_from) params.set('date_from', filters.date_from)
        if (filters.date_to) params.set('date_to', filters.date_to)
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
  }, [filters.project_id, filters.batch_id, filters.workspace_id, filters.status, filters.pipeline_stage, filters.claimed_by_id, filters.assigned_reviewer_id, filters.date_from, filters.date_to])

  useEffect(() => {
    api('/projects').then((p) => setProjects(Array.isArray(p) ? p : [])).catch(() => setProjects([]))
  }, [])

  const clearFilters = () => setFilters({ project_id: '', batch_id: '', workspace_id: '', status: '', pipeline_stage: '', claimed_by_id: '', assigned_reviewer_id: '', date_from: '', date_to: '', search: '' })
  const hasFilters = filters.project_id || filters.batch_id || filters.workspace_id || filters.status || filters.pipeline_stage || filters.claimed_by_id || filters.assigned_reviewer_id || filters.date_from || filters.date_to || filters.search

  const filteredTasks = filters.search
    ? tasks.filter((t) => {
        const c = t.content || {}
        const text = typeof c === 'string' ? c : (c.text || c.file || JSON.stringify(c)).toLowerCase()
        return text.includes(filters.search.toLowerCase())
      })
    : tasks

  const downloadTasksCsv = () => {
    const headers = ['Task ID', 'Batch ID', 'Status', 'Pipeline stage', 'Claimed by', 'Reviewer', 'Content preview']
    const rows = filteredTasks.map((t) => [
      t.id,
      t.batch_id,
      t.status,
      t.pipeline_stage,
      t.claimed_by_id ?? '',
      t.assigned_reviewer_id ?? '',
      (t.content?.text || t.content?.file || '').toString().slice(0, 80),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const downloadTasksJson = () => {
    const blob = new Blob([JSON.stringify(filteredTasks, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tasks-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClaim = async (taskId) => {
    setClaimingId(taskId)
    try {
      await api(`/queue/tasks/${taskId}/claim`, { method: 'POST' })
      const updated = await api(`/tasks/${taskId}`)
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
    } catch (e) {
      console.error(e)
    } finally {
      setClaimingId(null)
    }
  }
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
          <div className="filter-section">
            <label>Updated from (date)</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            />
          </div>
          <div className="filter-section">
            <label>Updated to (date)</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            />
          </div>
          <div className="filter-section">
            <label>Search in content</label>
            <input
              type="text"
              placeholder="Search in task content…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
        </aside>

        <div className="list-content">
          <div className="list-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="list-title">Task list</h1>
              <span className="list-results">{filteredTasks.length} result{filteredTasks.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={downloadTasksCsv} disabled={filteredTasks.length === 0}>Download CSV</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={downloadTasksJson} disabled={filteredTasks.length === 0}>Download JSON</button>
            </div>
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
                    <th>Claim (Ops)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        No tasks match the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((t) => {
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
                            {t.pipeline_stage === 'L1' && (
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleClaim(t.id)} disabled={claimingId === t.id}>
                                {claimingId === t.id ? '…' : 'Claim'}
                              </button>
                            )}
                          </td>
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
