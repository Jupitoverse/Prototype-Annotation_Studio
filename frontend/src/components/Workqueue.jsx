import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'

const MIN_SECONDS_PER_IMAGE = 3
const AUTO_SAVE_DEBOUNCE_MS = 1000

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

export function Workqueue({ user, canAnnotator, canReviewer, initialView }) {
  const [view, setView] = useState(initialView || (canAnnotator ? 'annotator' : 'reviewer'))
  const [assignments, setAssignments] = useState([])
  const [projects, setProjects] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [batches, setBatches] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [reviewTasks, setReviewTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [projectSchema, setProjectSchema] = useState(null)
  const [annotResponse, setAnnotResponse] = useState({})
  const [loading, setLoading] = useState(true)
  const [batchSlideMode, setBatchSlideMode] = useState(false)
  const [batchTasks, setBatchTasks] = useState([])
  const [slideIndex, setSlideIndex] = useState(0)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const [reviewSlideMode, setReviewSlideMode] = useState(false)
  const [reviewSlideIndex, setReviewSlideIndex] = useState(0)
  const [efficiencyStats, setEfficiencyStats] = useState(null)
  const [showOthersTasks, setShowOthersTasks] = useState(false)
  const [otherTasks, setOtherTasks] = useState([])
  const [requestingTaskId, setRequestingTaskId] = useState(null)
  const minTimeRef = useRef(null)
  const saveDraftRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [assignList, projList, wsList, myList, reviewList] = await Promise.all([
          api('/projects/my-assignments').catch(() => []),
          api('/projects').catch(() => []),
          api('/workspaces').catch(() => []),
          canAnnotator ? api('/queue/my-tasks') : Promise.resolve([]),
          canReviewer ? api('/queue/review') : Promise.resolve([]),
        ])
        if (!cancelled) {
          setAssignments(Array.isArray(assignList) ? assignList : [])
          setProjects(Array.isArray(projList) ? projList : [])
          setWorkspaces(Array.isArray(wsList) ? wsList : [])
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

  useEffect(() => {
    if (view !== 'annotator' || !canAnnotator) return
    let cancelled = false
    const q = selectedProjectId != null ? `?project_id=${selectedProjectId}` : ''
    api(`/queue/stats/efficiency${q}`)
      .then((data) => { if (!cancelled && data) setEfficiencyStats(data) })
      .catch(() => { if (!cancelled) setEfficiencyStats(null) })
    return () => { cancelled = true }
  }, [view, canAnnotator, selectedProjectId])

  const myProjectAssignments = view === 'annotator'
    ? assignments.filter((a) => a.role === 'annotator')
    : assignments.filter((a) => a.role === 'reviewer')
  const wsById = Object.fromEntries((workspaces || []).map((w) => [w.id, w]))
  const projectOptions = myProjectAssignments.length
    ? myProjectAssignments.map((a) => {
        const p = projects.find((x) => x.id === a.project_id)
        const wsName = p?.workspace_id && wsById[p.workspace_id]?.name ? ` · ${wsById[p.workspace_id].name}` : ''
        return { id: a.project_id, name: (a.project_name || p?.name || '') + wsName, percent: a.percent, eta_days: a.eta_days }
      })
    : projects.map((p) => {
        const wsName = p.workspace_id && wsById[p.workspace_id]?.name ? ` · ${wsById[p.workspace_id].name}` : ''
        return { id: p.id, name: (p.name || '') + wsName, percent: null, eta_days: null }
      })
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
    if (selectedTask && projectSchema) {
      const base = initialResponse(projectSchema)
      const draft = selectedTask.draft_response
      setAnnotResponse(draft && typeof draft === 'object' ? { ...base, ...draft } : base)
    }
  }, [selectedTask?.id, selectedTask?.draft_response, projectSchema])

  const currentSlideTask = batchSlideMode && batchTasks.length ? batchTasks[slideIndex] : null

  const startBatchSlideMode = useCallback(async () => {
    if (!batches.length) return
    try {
      const list = await api(`/queue/batch/${batches[0].id}/tasks`)
      const tasks = Array.isArray(list) ? list : []
      if (tasks.length === 0) return
      setBatchTasks(tasks)
      setSlideIndex(0)
      setBatchSlideMode(true)
      setMinTimeElapsed(false)
      const first = tasks[0]
      if (!first.claimed_by_id) {
        await api(`/queue/tasks/${first.id}/claim`, { method: 'POST' })
        const updated = await api(`/tasks/${first.id}`)
        setBatchTasks((prev) => prev.map((t) => (t.id === first.id ? updated : t)))
      }
      const batch = await api(`/batches/${first.batch_id}`)
      if (batch?.project_id) {
        const project = await api(`/projects/${batch.project_id}`)
        setProjectSchema(project?.response_schema || null)
      }
    } catch (e) {
      console.error(e)
    }
  }, [batches])

  useEffect(() => {
    if (!batchSlideMode || !currentSlideTask) return
    setMinTimeElapsed(false)
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_SECONDS_PER_IMAGE * 1000)
    return () => clearTimeout(t)
  }, [batchSlideMode, slideIndex, currentSlideTask?.id])

  useEffect(() => {
    if (!currentSlideTask || !projectSchema || saveDraftRef.current) return
    const id = setTimeout(() => {
      api(`/queue/tasks/${currentSlideTask.id}/save-draft`, {
        method: 'POST',
        body: JSON.stringify({ response: annotResponse, pipeline_stage: 'L1' }),
      }).catch(() => {})
    }, AUTO_SAVE_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [annotResponse, currentSlideTask?.id, projectSchema])

  const goPrev = () => {
    if (slideIndex <= 0) return
    setSlideIndex((i) => i - 1)
  }
  const goNext = async () => {
    if (slideIndex >= batchTasks.length - 1) return
    const current = batchTasks[slideIndex]
    await api(`/queue/tasks/${current.id}/save-draft`, {
      method: 'POST',
      body: JSON.stringify({ response: annotResponse, pipeline_stage: 'L1' }),
    }).catch(() => {})
    setSlideIndex((i) => i + 1)
    const next = batchTasks[slideIndex + 1]
    if (next && !next.claimed_by_id) {
      try {
        await api(`/queue/tasks/${next.id}/claim`, { method: 'POST' })
        const updated = await api(`/tasks/${next.id}`)
        setBatchTasks((prev) => prev.map((t) => (t.id === next.id ? updated : t)))
      } catch (_) {}
    }
  }
  const handleSkipCurrent = async () => {
    if (!currentSlideTask) return
    try {
      await api(`/queue/tasks/${currentSlideTask.id}/skip`, { method: 'POST' })
      setBatchTasks((prev) => prev.map((t) => (t.id === currentSlideTask.id ? { ...t, status: 'skipped' } : t)))
      if (slideIndex < batchTasks.length - 1) setSlideIndex((i) => i + 1)
      else setBatchSlideMode(false)
    } catch (e) {
      console.error(e)
    }
  }
  const handleUnskipCurrent = async () => {
    if (!currentSlideTask || currentSlideTask.status !== 'skipped') return
    try {
      await api(`/queue/tasks/${currentSlideTask.id}/unskip`, { method: 'POST' })
      setBatchTasks((prev) => prev.map((t) => (t.id === currentSlideTask.id ? { ...t, status: 'in_progress' } : t)))
      setMinTimeElapsed(false)
      setSlideStartTime(Date.now())
    } catch (e) {
      console.error(e)
    }
  }
  const handleSubmitCurrent = async () => {
    if (!currentSlideTask) return
    try {
      await api(`/queue/tasks/${currentSlideTask.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ response: annotResponse, pipeline_stage: 'L1' }),
      })
      setBatchTasks((prev) => {
        const next = prev.filter((t) => t.id !== currentSlideTask.id)
        if (next.length === 0) {
          setBatchSlideMode(false)
          const q = selectedProjectId != null ? `?project_id=${selectedProjectId}` : ''
          api(`/queue/stats/efficiency${q}`).then((d) => d && setEfficiencyStats(d)).catch(() => {})
        }
        return next
      })
      setSlideIndex((i) => {
        const nextLen = batchTasks.length - 1
        if (nextLen <= 0) return 0
        return Math.min(i, nextLen - 1)
      })
    } catch (e) {
      console.error(e)
    }
  }
  const exitBatchSlideMode = () => {
    setBatchSlideMode(false)
    setBatchTasks([])
    setSlideIndex(0)
    setSelectedTask(null)
    setAnnotResponse({})
    const q = selectedProjectId != null ? `?project_id=${selectedProjectId}` : ''
    api(`/queue/stats/efficiency${q}`).then((d) => d && setEfficiencyStats(d)).catch(() => {})
  }

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
      setReviewSlideIndex((i) => Math.max(0, Math.min(i, reviewTasks.length - 2)))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!selectedProject) return
    api(`/batches?project_id=${selectedProject}`).then(setBatches).catch(() => setBatches([]))
  }, [selectedProject])

  useEffect(() => {
    if (!showOthersTasks || !selectedProject || !user?.id) return
    api(`/tasks?project_id=${selectedProject}`)
      .then((list) => {
        const arr = Array.isArray(list) ? list : []
        setOtherTasks(arr.filter((t) => t.claimed_by_id != null && t.claimed_by_id !== user.id))
      })
      .catch(() => setOtherTasks([]))
  }, [showOthersTasks, selectedProject, user?.id])

  const handleRequestClaim = async (taskId) => {
    setRequestingTaskId(taskId)
    try {
      await api('/requests/claim', { method: 'POST', body: JSON.stringify({ task_id: taskId }) })
      setOtherTasks((prev) => prev.filter((t) => t.id !== taskId))
    } catch (e) {
      console.error(e)
    } finally {
      setRequestingTaskId(null)
    }
  }

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
            {efficiencyStats != null && efficiencyStats.total_completed > 0 && (
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h4>Your efficiency</h4>
                <p style={{ margin: 0, fontSize: '1.1rem' }}>
                  <strong>{efficiencyStats.efficiency_percent}%</strong>
                  {' '}({efficiencyStats.total_completed - efficiencyStats.sent_back_count}/{efficiencyStats.total_completed} approved first time
                  {efficiencyStats.sent_back_count > 0 ? `, ${efficiencyStats.sent_back_count} sent back for re-labelling` : ''})
                </p>
              </div>
            )}
            {projectOptions.length > 0 && (
              <div className="card">
                <h4>Project</h4>
                <p className="meta">Select a project you are assigned to. Claim tasks from its queue. {myProjectAssignments.length > 0 ? 'Assigned projects listed first.' : 'No assignments yet — all projects shown. Ask Ops to assign you for task distribution.'}</p>
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={handleGetNext} disabled={!batches.length}>Get next task</button>
                <button type="button" className="btn btn-secondary" onClick={startBatchSlideMode} disabled={!batches.length}>
                  Start batch (image-by-image)
                </button>
              </div>
            </div>
            {selectedProject && (
              <div className="card">
                <h4>Tasks assigned to others (same project)</h4>
                <p className="meta">You can request to take a task from a colleague. One approval (assignee or Ops/Admin) is needed. See the Requests tab for status.</p>
                <label className="task-panel-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="checkbox" checked={showOthersTasks} onChange={(e) => setShowOthersTasks(e.target.checked)} />
                  <span>Show tasks assigned to others</span>
                </label>
                {showOthersTasks && (
                  otherTasks.length === 0 ? (
                    <p className="meta">No tasks currently assigned to others in this project.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {otherTasks.map((t) => (
                        <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span className="status-badge pending">{t.status}</span>
                          <span>Task #{t.id} — {t.content?.file || t.content?.text?.slice(0, 40) || '—'}</span>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRequestClaim(t.id)} disabled={requestingTaskId === t.id}>
                            {requestingTaskId === t.id ? '…' : 'Request to claim'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            )}
            {batchSlideMode && batchTasks.length > 0 && (
              <div className="card slide-view-card annotation-enlarged" style={{ marginTop: '1.5rem', maxWidth: 960, width: '100%' }}>
                <div className="slide-progress-wrap">
                  <div className="slide-progress-bar" style={{ width: `${((slideIndex + 1) / batchTasks.length) * 100}%` }} />
                  <span className="slide-progress-text">{slideIndex + 1} / {batchTasks.length}</span>
                </div>
                {currentSlideTask && (
                  <>
                    <div className="slide-image-wrap" style={{ minHeight: 360 }}>
                      {currentSlideTask.content?.url ? (
                        <img src={currentSlideTask.content.url} alt="" style={{ maxWidth: '100%', maxHeight: 'min(480px, 55vh)', objectFit: 'contain' }} />
                      ) : (
                        <div className="slide-image-placeholder">
                          <span className="slide-image-label">Image / file</span>
                          <span className="slide-image-name">{currentSlideTask.content?.file || `Task #${currentSlideTask.id}`}</span>
                        </div>
                      )}
                    </div>
                    <div className="task-panel" style={{ marginTop: '1rem' }}>
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
                    <div className="slide-actions">
                      <button type="button" className="btn btn-secondary" onClick={goPrev} disabled={slideIndex === 0}>Prev</button>
                      <button type="button" className="btn btn-secondary" onClick={goNext} disabled={slideIndex >= batchTasks.length - 1 || (!minTimeElapsed && currentSlideTask?.status !== 'skipped')}>
                        Next {!minTimeElapsed && currentSlideTask?.status !== 'skipped' ? `(${MIN_SECONDS_PER_IMAGE}s min)` : ''}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleSkipCurrent}>Skip (review later)</button>
                      {currentSlideTask?.status === 'skipped' && (
                        <button type="button" className="btn btn-secondary" onClick={handleUnskipCurrent}>Unskip & annotate</button>
                      )}
                      <button type="button" className="btn btn-primary" onClick={handleSubmitCurrent}>Submit for review</button>
                      <button type="button" className="btn btn-secondary" onClick={exitBatchSlideMode}>Exit batch</button>
                    </div>
                    <p className="meta" style={{ marginTop: '0.5rem' }}>Auto-save enabled. Stay at least 3s per image unless you skip.</p>
                    {batchTasks.filter((t) => t.status === 'skipped').length > 0 && (
                      <div className="slide-skipped-wrap" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                        <h5 style={{ marginBottom: '0.5rem' }}>Skipped ({batchTasks.filter((t) => t.status === 'skipped').length})</h5>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {batchTasks.map((t, idx) => (
                            t.status === 'skipped' && (
                              <button
                                key={t.id}
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setSlideIndex(idx); setMinTimeElapsed(true); }}
                              >
                                Task #{t.id}
                              </button>
                            )
                          ))}
                        </div>
                        <p className="meta" style={{ marginTop: '0.35rem' }}>Click to go back and annotate. Use Unskip when done.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
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
              <div className="card annotation-enlarged" style={{ marginTop: '1.5rem', maxWidth: 960, width: '100%' }}>
                <h4>Label task #{selectedTask.id}</h4>
                <p className="meta">{taskContentPreview(selectedTask.content)}</p>
                {selectedTask.content?.url && (
                  <div className="slide-image-wrap" style={{ marginBottom: '1rem', minHeight: 280 }}>
                    <img src={selectedTask.content.url} alt="" style={{ maxWidth: '100%', maxHeight: 'min(400px, 50vh)', objectFit: 'contain' }} />
                  </div>
                )}
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
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    className={reviewSlideMode ? 'btn btn-primary' : 'btn btn-secondary'}
                    onClick={() => { setReviewSlideMode(true); setReviewSlideIndex(0); }}
                  >
                    Review as slides (FIFO)
                  </button>
                  {reviewSlideMode && (
                    <button type="button" className="btn btn-secondary" style={{ marginLeft: '0.5rem' }} onClick={() => setReviewSlideMode(false)}>
                      Show as grid
                    </button>
                  )}
                </div>
                {reviewSlideMode ? (
                  (() => {
                    const rt = reviewTasks[reviewSlideIndex]
                    if (!rt) return null
                    return (
                      <div className="card slide-view-card annotation-enlarged" style={{ maxWidth: 960, width: '100%' }}>
                        <div className="slide-progress-wrap">
                          <div className="slide-progress-bar" style={{ width: `${((reviewSlideIndex + 1) / reviewTasks.length) * 100}%` }} />
                          <span className="slide-progress-text">{reviewSlideIndex + 1} / {reviewTasks.length}</span>
                        </div>
                        <div className="slide-image-wrap" style={{ minHeight: 360 }}>
                          {rt.content?.url ? (
                            <img src={rt.content.url} alt="" style={{ maxWidth: '100%', maxHeight: 'min(480px, 55vh)', objectFit: 'contain' }} />
                          ) : (
                            <div className="slide-image-placeholder">
                              <span className="slide-image-label">Image / file</span>
                              <span className="slide-image-name">{rt.content?.file || `Task #${rt.id}`}</span>
                            </div>
                          )}
                        </div>
                        {rt.rework_count > 0 && (
                          <p className="meta" style={{ color: 'var(--accent-secondary)', marginTop: '0.5rem' }}>
                            Sent back for re-labelling: {rt.rework_count} time{rt.rework_count !== 1 ? 's' : ''}
                          </p>
                        )}
                        <div className="slide-actions" style={{ marginTop: '1rem' }}>
                          <button type="button" className="btn btn-secondary" onClick={() => setReviewSlideIndex((i) => Math.max(0, i - 1))} disabled={reviewSlideIndex === 0}>
                            Prev
                          </button>
                          <button type="button" className="btn btn-secondary" onClick={() => setReviewSlideIndex((i) => Math.min(reviewTasks.length - 1, i + 1))} disabled={reviewSlideIndex >= reviewTasks.length - 1}>
                            Next
                          </button>
                          <button type="button" className="btn btn-primary" onClick={() => handleApprove(rt.id)}>Approve</button>
                          <button type="button" className="btn btn-secondary" onClick={() => handleReject(rt.id)}>
                            Send back for re-labelling
                          </button>
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <div className="home-grid">
                    {reviewTasks.map((t) => (
                      <div key={t.id} className="card">
                        <h4>Task #{t.id}</h4>
                        <p className="task-content" style={{ fontSize: '0.9rem' }}>{taskContentPreview(t.content)}</p>
                        {t.rework_count > 0 && <p className="meta" style={{ color: 'var(--accent-secondary)' }}>Rework: {t.rework_count}</p>}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                          <button type="button" className="btn btn-primary" onClick={() => handleApprove(t.id)}>Approve</button>
                          <button type="button" className="btn btn-secondary" onClick={() => handleReject(t.id)}>Send back for re-labelling</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
