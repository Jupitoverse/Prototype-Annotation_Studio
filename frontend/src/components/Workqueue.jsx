import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

/** Build initial response object from schema (keys = attribute names, values = '' or false for checkbox) */
function initialResponse(schema) {
  if (!schema || typeof schema !== 'object') return {}
  const out = {}
  for (const key of Object.keys(schema)) {
    const v = schema[key]
    if (v === 'checkbox') out[key] = false
    else if (v === 'multi_select' || (typeof v === 'string' && v.startsWith('multi_select:'))) out[key] = []
    else out[key] = ''
  }
  return out
}

/** Render one form field from schema entry. schemaValue is either a type (free_text, checkbox, number, ...) or options string (a,b,c). */
function SchemaField({ name, schemaValue, value, onChange }) {
  const typeKeywords = ['free_text', 'textarea', 'checkbox', 'number', 'date', 'url', 'email']
  const isType = typeof schemaValue === 'string' && typeKeywords.includes(schemaValue)
  const options = typeof schemaValue === 'string' && !isType && schemaValue.includes(',') ? schemaValue.split(',').map((s) => s.trim()).filter(Boolean) : []
  const isSelect = options.length > 0
  const isMulti = schemaValue === 'multi_select' || (typeof schemaValue === 'string' && schemaValue.startsWith('multi_select:'))
  const multiOptions = isMulti && typeof schemaValue === 'string' && schemaValue.startsWith('multi_select:') ? schemaValue.slice('multi_select:'.length).split(',').map((s) => s.trim()).filter(Boolean) : []

  if (schemaValue === 'checkbox') {
    return (
      <label className="task-panel-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(name, e.target.checked)} />
        <span>{name.replace(/_/g, ' ')}</span>
      </label>
    )
  }
  if (schemaValue === 'textarea' || schemaValue === 'free_text') {
    return (
      <>
        <label className="form-label" style={{ marginTop: '0.75rem' }}>{name.replace(/_/g, ' ')}</label>
        <textarea
          className="form-input"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          rows={schemaValue === 'textarea' ? 4 : 2}
          placeholder={name.replace(/_/g, ' ')}
        />
      </>
    )
  }
  if (schemaValue === 'number') {
    return (
      <>
        <label className="form-label" style={{ marginTop: '0.75rem' }}>{name.replace(/_/g, ' ')}</label>
        <input type="number" className="form-input" value={value} onChange={(e) => onChange(name, e.target.value)} />
      </>
    )
  }
  if (schemaValue === 'date') {
    return (
      <>
        <label className="form-label" style={{ marginTop: '0.75rem' }}>{name.replace(/_/g, ' ')}</label>
        <input type="date" className="form-input" value={value} onChange={(e) => onChange(name, e.target.value)} />
      </>
    )
  }
  if (schemaValue === 'url') {
    return (
      <>
        <label className="form-label" style={{ marginTop: '0.75rem' }}>{name.replace(/_/g, ' ')}</label>
        <input type="url" className="form-input" value={value} onChange={(e) => onChange(name, e.target.value)} placeholder="https://" />
      </>
    )
  }
  if (schemaValue === 'email') {
    return (
      <>
        <label className="form-label" style={{ marginTop: '0.75rem' }}>{name.replace(/_/g, ' ')}</label>
        <input type="email" className="form-input" value={value} onChange={(e) => onChange(name, e.target.value)} />
      </>
    )
  }
  if (isMulti) {
    const arr = Array.isArray(value) ? value : []
    const opts = multiOptions.length ? multiOptions : options
    return (
      <>
        <label className="form-label" style={{ marginTop: '0.75rem' }}>{name.replace(/_/g, ' ')}</label>
        <select
          multiple
          className="form-input"
          value={arr}
          onChange={(e) => onChange(name, Array.from(e.target.selectedOptions, (o) => o.value))}
          style={{ minHeight: 80 }}
        >
          {opts.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <p className="meta" style={{ marginTop: '0.25rem' }}>Hold Ctrl/Cmd to select multiple.</p>
      </>
    )
  }
  if (isSelect) {
    return (
      <>
        <label className="form-label" style={{ marginTop: '0.75rem' }}>{name.replace(/_/g, ' ')}</label>
        <select className="form-input" value={value} onChange={(e) => onChange(name, e.target.value)}>
          <option value="">Select</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </>
    )
  }
  return (
    <>
      <label className="form-label" style={{ marginTop: '0.75rem' }}>{name.replace(/_/g, ' ')}</label>
      <input type="text" className="form-input" value={value} onChange={(e) => onChange(name, e.target.value)} placeholder={name.replace(/_/g, ' ')} />
    </>
  )
}

export function Workqueue({ user, canAnnotator, canReviewer }) {
  const [view, setView] = useState(canAnnotator ? 'annotator' : 'reviewer')
  const [assignments, setAssignments] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [batches, setBatches] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [reviewTasks, setReviewTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [projectSchema, setProjectSchema] = useState(null)
  const [annotResponse, setAnnotResponse] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [assignList, projList, myList, reviewList] = await Promise.all([
          api('/projects/my-assignments').catch(() => []),
          api('/projects').catch(() => []),
          canAnnotator ? api('/queue/my-tasks') : Promise.resolve([]),
          canReviewer ? api('/queue/review') : Promise.resolve([]),
        ])
        if (!cancelled) {
          setAssignments(Array.isArray(assignList) ? assignList : [])
          setProjects(Array.isArray(projList) ? projList : [])
          setMyTasks(Array.isArray(myList) ? myList : [])
          setReviewTasks(Array.isArray(reviewList) ? reviewList : [])
        }
      } catch {
        if (!cancelled) setMyTasks([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [canAnnotator, canReviewer])

  const myProjectAssignments = view === 'annotator'
    ? assignments.filter((a) => a.role === 'annotator')
    : assignments.filter((a) => a.role === 'reviewer')
  const projectOptions = myProjectAssignments.length
    ? myProjectAssignments.map((a) => ({ id: a.project_id, name: a.project_name, percent: a.percent, eta_days: a.eta_days }))
    : projects.map((p) => ({ id: p.id, name: p.name, percent: null, eta_days: null }))
  const selectedProject = selectedProjectId ?? projectOptions[0]?.id

  const loadSchemaForTask = useCallback(async (task) => {
    if (!task?.batch_id) return
    try {
      const batch = await api(`/batches/${task.batch_id}`)
      if (batch?.project_id) {
        const project = await api(`/projects/${batch.project_id}`)
        setProjectSchema(project?.response_schema || null)
      }
    } catch {
      setProjectSchema(null)
    }
  }, [])

  useEffect(() => {
    if (selectedTask) {
      loadSchemaForTask(selectedTask)
      setAnnotResponse({})
    }
  }, [selectedTask?.id, loadSchemaForTask])

  useEffect(() => {
    if (selectedTask && projectSchema) setAnnotResponse(initialResponse(projectSchema))
  }, [selectedTask?.id, projectSchema])

  const handleGetNext = async () => {
    if (!batches.length) return
    try {
      const task = await api(`/queue/next?batch_id=${batches[0].id}`)
      if (task) {
        setMyTasks((prev) => [task, ...prev])
        setSelectedTask(task)
        setAnnotResponse({})
      }
    } catch (e) {
      console.error(e)
    }
  }

  const setResponseField = (name, val) => setAnnotResponse((r) => ({ ...r, [name]: val }))

  const handleSubmitAnnotation = async () => {
    if (!selectedTask) return
    try {
      await api(`/queue/tasks/${selectedTask.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ response: annotResponse, pipeline_stage: 'L1' }),
      })
      setMyTasks((prev) => prev.filter((t) => t.id !== selectedTask.id))
      setSelectedTask(null)
      setAnnotResponse({})
    } catch (e) {
      console.error(e)
    }
  }

  const handleApprove = async (taskId) => {
    try {
      await api(`/queue/review/${taskId}/approve`, { method: 'POST' })
      setReviewTasks((prev) => prev.filter((t) => t.id !== taskId))
    } catch (e) {
      console.error(e)
    }
  }

  const handleReject = async (taskId) => {
    try {
      await api(`/queue/review/${taskId}/reject`, { method: 'POST' })
      setReviewTasks((prev) => prev.filter((t) => t.id !== taskId))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!selectedProject) return
    api(`/batches?project_id=${selectedProject}`).then(setBatches).catch(() => setBatches([]))
  }, [selectedProject])

  const taskContentPreview = (content) => {
    if (!content) return '—'
    if (content.text) return String(content.text).slice(0, 80) + (content.text.length > 80 ? '…' : '')
    if (content.file) return `File: ${content.file}`
    return JSON.stringify(content).slice(0, 60) + '…'
  }

  return (
    <>
      <h1 className="page-title">Workqueue</h1>
      <p className="page-desc">My tasks (annotator) · Review queue (reviewer)</p>

      <div className="section">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {canAnnotator && (
            <button type="button" className={`btn ${view === 'annotator' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('annotator')}>
              My tasks
            </button>
          )}
          {canReviewer && (
            <button type="button" className={`btn ${view === 'reviewer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('reviewer')}>
              Review queue
            </button>
          )}
        </div>

        {view === 'annotator' && (
          <>
            {projectOptions.length > 0 && (
              <div className="card">
                <h4>Project</h4>
                <p className="meta">Select a project you are assigned to. Claim tasks from its queue.</p>
                <select
                  className="form-input"
                  value={selectedProject ?? ''}
                  onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value, 10) : null)}
                >
                  {projectOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                      {opt.percent != null ? ` (${opt.percent}%)` : ''}
                      {opt.eta_days != null ? ` · ETA ${opt.eta_days} days` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="card">
              <h4>Get next task</h4>
              <p className="meta">Claim one unassigned task from the selected project. Or work on tasks already assigned to you below.</p>
              <button type="button" className="btn btn-primary" onClick={handleGetNext} disabled={!batches.length}>Get next task</button>
            </div>
            <h3 style={{ marginTop: '1.5rem' }}>My tasks</h3>
            {loading ? (
              <p className="empty">Loading…</p>
            ) : myTasks.length === 0 ? (
              <p className="empty">No tasks assigned. Get a task from the queue above, or wait for Ops to assign tasks when sending for annotation.</p>
            ) : (
              <div className="home-grid">
                {myTasks.map((t) => (
                  <div key={t.id} className="card">
                    <h4>Task #{t.id}</h4>
                    <p className="task-content" style={{ fontSize: '0.9rem' }}>{taskContentPreview(t.content)}</p>
                    {(t.age_days != null || t.remaining_days != null) && (
                      <p className="meta" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                        {t.age_days != null && <>Age: {t.age_days} days</>}
                        {t.remaining_days != null && (
                          <span style={{ marginLeft: t.age_days != null ? '0.75rem' : 0, color: t.remaining_days < 0 ? 'var(--danger)' : undefined }}>
                            {t.remaining_days < 0 ? `${Math.abs(t.remaining_days).toFixed(0)} days overdue` : `${t.remaining_days.toFixed(0)} days left`}
                          </span>
                        )}
                      </p>
                    )}
                    <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => { setSelectedTask(t); setProjectSchema(null); setAnnotResponse({}); }}>Label</button>
                  </div>
                ))}
              </div>
            )}
            {selectedTask && (
              <div className="card" style={{ marginTop: '1.5rem', maxWidth: '560px' }}>
                <h4>Label task #{selectedTask.id}</h4>
                <p className="meta">{taskContentPreview(selectedTask.content)}</p>
                <div className="task-panel">
                  {projectSchema && Object.keys(projectSchema).length > 0 ? (
                    Object.entries(projectSchema).map(([name, schemaValue]) => (
                      <SchemaField
                        key={name}
                        name={name}
                        schemaValue={schemaValue}
                        value={annotResponse[name]}
                        onChange={setResponseField}
                      />
                    ))
                  ) : (
                    <p className="meta">Loading schema…</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button type="button" className="btn btn-primary" onClick={handleSubmitAnnotation}>Submit for review</button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setSelectedTask(null); setAnnotResponse({}); }}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}

        {view === 'reviewer' && (
          <>
            <h3>Tasks in review</h3>
            {reviewTasks.length === 0 ? (
              <p className="empty">No tasks in review. Annotators submit work to appear here.</p>
            ) : (
              <div className="home-grid">
                {reviewTasks.map((t) => (
                  <div key={t.id} className="card">
                    <h4>Task #{t.id}</h4>
                    <p className="task-content" style={{ fontSize: '0.9rem' }}>{taskContentPreview(t.content)}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button type="button" className="btn btn-primary" onClick={() => handleApprove(t.id)}>Approve</button>
                      <button type="button" className="btn btn-secondary" onClick={() => handleReject(t.id)}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
