import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const SORT_OPTIONS = [
  { value: 'updated_desc', label: 'Updated (newest first)' },
  { value: 'updated_asc', label: 'Updated (oldest first)' },
  { value: 'status', label: 'Status' },
]

function userDisplay(u) {
  return (u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '').trim() || u.email
}

export function TasksByRole({ role = 'annotator', title, emptyMessage }) {
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [batchMap, setBatchMap] = useState({})
  const [projectMap, setProjectMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [assigneeId, setAssigneeId] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('updated_desc')
  const navigate = useNavigate()

  const paramKey = role === 'annotator' ? 'claimed_by_id' : 'assigned_reviewer_id'

  useEffect(() => {
    setLoading(true)
    let cancelled = false
    async function load() {
      try {
        const [userList, taskList] = await Promise.all([
          api(`/users/by-role?role=${role}`).catch(() => []),
          assigneeId ? api(`/tasks?${paramKey}=${assigneeId}`) : api('/tasks'),
        ])
        if (cancelled) return
        setUsers(Array.isArray(userList) ? userList : [])
        const list = Array.isArray(taskList) ? taskList : []
        if (role === 'annotator') {
          setTasks(list.filter((t) => t.claimed_by_id != null))
        } else {
          setTasks(list.filter((t) => t.assigned_reviewer_id != null))
        }
      } catch {
        if (!cancelled) setTasks([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [role, assigneeId, paramKey])

  useEffect(() => {
    const batchIds = [...new Set(tasks.map((t) => t.batch_id))]
    if (batchIds.length === 0) return
    let cancelled = false
    Promise.all(batchIds.map((id) => api(`/batches/${id}`).catch(() => null))).then((batches) => {
      if (cancelled) return
      const bMap = {}
      batches.forEach((b) => { if (b) bMap[b.id] = b })
      setBatchMap(bMap)
      const projectIds = [...new Set(Object.values(bMap).map((b) => b.project_id).filter(Boolean))]
      return Promise.all(projectIds.map((id) => api(`/projects/${id}`).catch(() => null)))
    }).then((projs) => {
      if (cancelled) return
      const pMap = {}
      ;(projs || []).forEach((p) => { if (p) pMap[p.id] = p })
      setProjectMap(pMap)
    })
    return () => { cancelled = true }
  }, [tasks])

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

  let filtered = tasks
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter((t) => {
      const name = taskDisplayName(t).toLowerCase()
      const content = JSON.stringify(t.content || {}).toLowerCase()
      return name.includes(q) || content.includes(q)
    })
  }
  if (sort === 'updated_desc') {
    filtered = [...filtered].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
  } else if (sort === 'updated_asc') {
    filtered = [...filtered].sort((a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0))
  } else if (sort === 'status') {
    filtered = [...filtered].sort((a, b) => (a.status || '').localeCompare(b.status || ''))
  }

  return (
    <div className="list-page">
      <aside className="list-filter-panel">
        <h3>FILTER BY</h3>
        <div className="filter-section">
          <label>{role === 'annotator' ? 'Annotator' : 'Reviewer'}</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">All</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{userDisplay(u)}</option>
            ))}
          </select>
        </div>
        <div className="filter-section">
          <label>Search</label>
          <input
            type="text"
            placeholder="Search task content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-section">
          <label>Sort</label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </aside>
      <div className="list-content">
        <div className="list-header">
          <h1 className="list-title">{title}</h1>
          <span className="list-results">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
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
                  <th>Project</th>
                  <th>Pipeline stage</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="list-empty-cell">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
                    const batch = batchMap[t.batch_id]
                    const project = batch ? projectMap[batch.project_id] : null
                    return (
                      <tr key={t.id}>
                        <td>{taskDisplayName(t)}</td>
                        <td>
                          <span className={`status-badge ${statusBadgeClass(t.status)}`}>{t.status}</span>
                        </td>
                        <td>
                          {project ? (
                            <button type="button" className="link" onClick={() => navigate(`/projects/${project.id}`)}>
                              {project.name}
                            </button>
                          ) : '—'}
                        </td>
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
  )
}
