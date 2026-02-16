import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const STEPS = [
  '1. Start',
  '2. Data Import',
  '3. Configure Labels',
  '4. Assign Annotators',
  '5. Assign Reviewers',
  '6. Send for Annotation',
]

/** Format bytes to human-readable */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/** Get file metrics (size, type, and for media: dimensions/duration) */
function getFileMetrics(file) {
  const ext = (file.name || '').split('.').pop() || ''
  const type = file.type || ''
  const base = { id: `${file.name}-${file.size}-${Date.now()}`, name: file.name, size: file.size, sizeFormatted: formatBytes(file.size), type: type || ext || 'file', extension: ext, file }
  const isImage = type.startsWith('image/') || /^(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(ext)
  const isVideo = type.startsWith('video/') || /^(mp4|webm|ogg|mov|avi)$/i.test(ext)
  const isAudio = type.startsWith('audio/') || /^(mp3|wav|ogg|m4a|aac)$/i.test(ext)
  if (isImage) {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ ...base, dimensions: `${img.width} × ${img.height}`, width: img.width, height: img.height })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({ ...base, dimensions: '—' })
      }
      img.src = url
    })
  }
  if (isVideo || isAudio) {
    return new Promise((resolve) => {
      const el = document.createElement(isVideo ? 'video' : 'audio')
      const url = URL.createObjectURL(file)
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        const dur = el.duration
        const m = Math.floor(dur / 60)
        const s = Math.floor(dur % 60)
        resolve({ ...base, duration: dur, durationFormatted: `${m}:${s.toString().padStart(2, '0')}` })
      }
      el.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({ ...base, durationFormatted: '—' })
      }
      el.src = url
    })
  }
  return Promise.resolve(base)
}

export function NewProject() {
  const [step, setStep] = useState(0)
  const [workspaces, setWorkspaces] = useState([])
  const [form, setForm] = useState({
    workspace_id: null,
    name: '',
    description: '',
    pipeline_template: 'default',
    profile_type: 'parent',
  })
  const [fileMetricsList, setFileMetricsList] = useState([])
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [dataInsight, setDataInsight] = useState(null)
  const [attributes, setAttributes] = useState([{ name: 'animal_name', type: 'single_select', options: 'dog,cat,bird,elephant,lion,tiger,bear,other' }, { name: 'description', type: 'free_text', options: '' }])
  // Assignments: { id, name, percent } — total must be 100%
  const [annotatorAssignments, setAnnotatorAssignments] = useState([])
  const [reviewerAssignments, setReviewerAssignments] = useState([])
  const [annotatorUsers, setAnnotatorUsers] = useState([])
  const [reviewerUsers, setReviewerUsers] = useState([])
  const [assignDropdownOpen, setAssignDropdownOpen] = useState({ annotator: false, reviewer: false })
  const [createdProjectId, setCreatedProjectId] = useState(null)
  const [createdProjectRef, setCreatedProjectRef] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api('/workspaces').then(setWorkspaces).catch(() => setWorkspaces([]))
  }, [])

  const loadAnnotatorsAndReviewers = useCallback(async () => {
    try {
      const [annotators, reviewers] = await Promise.all([
        api('/users/by-role?role=annotator').then((r) => (Array.isArray(r) ? r : [])),
        api('/users/by-role?role=reviewer').then((r) => (Array.isArray(r) ? r : [])),
      ])
      setAnnotatorUsers(annotators)
      setReviewerUsers(reviewers)
    } catch (e) {
      setAnnotatorUsers([])
      setReviewerUsers([])
    }
  }, [])

  useEffect(() => {
    loadAnnotatorsAndReviewers()
  }, [loadAnnotatorsAndReviewers])

  useEffect(() => {
    if (step === 3 || step === 4) loadAnnotatorsAndReviewers()
  }, [step, loadAnnotatorsAndReviewers])

  const setEqualPct = (list) => {
    if (!list.length) return []
    const n = list.length
    const base = Math.floor(1000 / n) / 10
    const remainder = Math.round((100 - base * n) * 10) / 10
    return list.map((a, i) => ({ ...a, percent: i === n - 1 ? base + remainder : base, eta_days: a.eta_days ?? null }))
  }

  const setAnnotatorSelection = (selectedUsers) => {
    const next = selectedUsers.map((u) => ({
      id: u.id,
      name: (u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '').trim() || u.email,
      eta_days: null,
    }))
    setAnnotatorAssignments(setEqualPct(next))
  }

  const setReviewerSelection = (selectedUsers) => {
    const next = selectedUsers.map((u) => ({
      id: u.id,
      name: (u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '').trim() || u.email,
      eta_days: null,
    }))
    setReviewerAssignments(setEqualPct(next))
  }

  const updateAnnotatorPercent = (index, value) => {
    const num = Math.max(0, Math.min(100, parseFloat(value) || 0))
    setAnnotatorAssignments((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], percent: num }
      return next
    })
  }

  const updateReviewerPercent = (index, value) => {
    const num = Math.max(0, Math.min(100, parseFloat(value) || 0))
    setReviewerAssignments((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], percent: num }
      return next
    })
  }

  const updateAnnotatorEta = (index, value) => {
    const num = value === '' || value == null ? null : Math.max(0, parseFloat(value) || 0)
    setAnnotatorAssignments((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], eta_days: num }
      return next
    })
  }

  const updateReviewerEta = (index, value) => {
    const num = value === '' || value == null ? null : Math.max(0, parseFloat(value) || 0)
    setReviewerAssignments((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], eta_days: num }
      return next
    })
  }

  const removeAnnotator = (index) => {
    setAnnotatorAssignments((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return setEqualPct(next.map((a) => ({ id: a.id, name: a.name, percent: 0, eta_days: a.eta_days })))
    })
  }

  const removeReviewer = (index) => {
    setReviewerAssignments((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return setEqualPct(next.map((a) => ({ id: a.id, name: a.name, percent: 0, eta_days: a.eta_days })))
    })
  }

  const annotatorTotal = annotatorAssignments.reduce((s, a) => s + (a.percent || 0), 0)
  const reviewerTotal = reviewerAssignments.reduce((s, a) => s + (a.percent || 0), 0)
  const annotatorTotalValid = annotatorAssignments.length === 0 || Math.abs(annotatorTotal - 100) < 0.02
  const reviewerTotalValid = reviewerAssignments.length === 0 || Math.abs(reviewerTotal - 100) < 0.02

  const handleCreateProject = async () => {
    if (!form.workspace_id || !form.name) {
      setError('Workspace and project name required')
      return
    }
    setError('')
    setLoading(true)
    try {
      const proj = await api('/projects', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: form.workspace_id,
          name: form.name,
          description: form.description || '',
          pipeline_template: form.pipeline_template,
          profile_type: form.profile_type,
          status: 'draft',
          response_schema: attributes.reduce((acc, a) => {
            if (a.type === 'multi_select') return { ...acc, [a.name]: a.options ? `multi_select:${a.options}` : 'multi_select:' }
            if (a.type === 'single_select' || a.type === 'color_identifier') return { ...acc, [a.name]: a.options || a.type }
            return { ...acc, [a.name]: a.type }
          }, {}),
        }),
      })
      setCreatedProjectId(proj.id)
      setCreatedProjectRef(proj)
      setStep(1) // Data Import
    } catch (err) {
      setError(err.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const processNewFiles = useCallback(async (files) => {
    const list = Array.from(files).slice(0, 100)
    if (list.length === 0) return
    setMetricsLoading(true)
    try {
      const metrics = await Promise.all(list.map(getFileMetrics))
      setFileMetricsList((prev) => [...prev, ...metrics].slice(0, 100))
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  const removeFileMetric = (id) => setFileMetricsList((prev) => prev.filter((m) => m.id !== id))

  const onDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    processNewFiles(e.dataTransfer.files || [])
  }

  const onDragOver = (e) => {
    e.preventDefault()
    setDragActive(true)
  }

  const onDragLeave = () => setDragActive(false)

  useEffect(() => {
    const total = fileMetricsList.length + (pastedText.trim() ? 1 : 0)
    const byType = {}
    fileMetricsList.forEach((m) => {
      const t = m.extension || m.type || 'file'
      byType[t] = (byType[t] || 0) + 1
    })
    if (pastedText.trim()) byType['text'] = (byType['text'] || 0) + 1
    setDataInsight(total > 0 ? { total, byType } : null)
  }, [fileMetricsList.length, pastedText])

  /** Distribute task indices by percentage: returns array of length taskCount with annotator index per task. */
  const distributeByPercent = (assignments, taskCount) => {
    if (!assignments.length || taskCount === 0) return []
    const counts = assignments.map((a) => Math.round(((a.percent || 0) / 100) * taskCount))
    let sum = counts.reduce((s, c) => s + c, 0)
    let i = 0
    while (sum < taskCount && i < counts.length) { counts[i]++; sum++; i = (i + 1) % counts.length }
    while (sum > taskCount && i < counts.length) { if (counts[i] > 0) { counts[i]--; sum-- } i = (i + 1) % counts.length }
    const result = []
    assignments.forEach((_, idx) => {
      for (let k = 0; k < counts[idx]; k++) result.push(idx)
    })
    return result
  }

  const handleSendForAnnotation = async () => {
    if (!createdProjectId) return
    if (!annotatorTotalValid || !reviewerTotalValid) {
      setError('Annotator and Reviewer totals must equal 100%')
      return
    }
    setLoading(true)
    setError('')
    try {
      const responseSchema = attributes.reduce((acc, a) => {
        if (a.type === 'multi_select') return { ...acc, [a.name]: a.options ? `multi_select:${a.options}` : 'multi_select:' }
        if (a.type === 'single_select' || a.type === 'color_identifier') return { ...acc, [a.name]: a.options || a.type }
        return { ...acc, [a.name]: a.type }
      }, {})
      const annotatorIds = annotatorAssignments.map((a) => a.id)
      const reviewerIds = reviewerAssignments.map((a) => a.id)
      const annotatorPct = annotatorAssignments.map((a) => a.percent ?? 0)
      const reviewerPct = reviewerAssignments.map((a) => a.percent ?? 0)
      const annotatorEtaDays = annotatorAssignments.map((a) => a.eta_days ?? null)
      const reviewerEtaDays = reviewerAssignments.map((a) => a.eta_days ?? null)
      await api(`/projects/${createdProjectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          description: form.description || '',
          status: 'active',
          response_schema: responseSchema,
          annotator_ids: annotatorIds,
          reviewer_ids: reviewerIds,
          annotator_pct: annotatorPct,
          reviewer_pct: reviewerPct,
          annotator_eta_days: annotatorEtaDays,
          reviewer_eta_days: reviewerEtaDays,
          num_annotators: annotatorIds.length,
          num_reviewers: reviewerIds.length,
        }),
      })
      const batchRes = await api('/batches', {
        method: 'POST',
        body: JSON.stringify({ project_id: createdProjectId, name: 'Batch 1' }),
      })
      const tasksFromPaste = pastedText.trim() ? pastedText.split(/\n+/).filter(Boolean).map((t) => ({ text: t })) : []
      const tasksFromFiles = fileMetricsList.slice(0, 50).map((m) => ({ file: m.name, type: m.extension, size: m.size, dimensions: m.dimensions, duration: m.durationFormatted }))
      const items = tasksFromPaste.length ? tasksFromPaste : (tasksFromFiles.length ? tasksFromFiles : [{ text: 'Sample task 1' }, { text: 'Sample task 2' }])
      const createdTasks = await api('/tasks/bulk', {
        method: 'POST',
        body: JSON.stringify({ batch_id: batchRes.id, items }),
      })
      const taskList = Array.isArray(createdTasks) ? createdTasks : []
      const annotatorDist = distributeByPercent(annotatorAssignments, taskList.length)
      const reviewerDist = distributeByPercent(reviewerAssignments, taskList.length)
      const now = new Date()
      for (let i = 0; i < taskList.length; i++) {
        const t = taskList[i]
        const annotatorIdx = annotatorDist[i]
        const reviewerIdx = reviewerDist[i]
        const annotatorId = annotatorIdx != null && annotatorIds[annotatorIdx] ? annotatorIds[annotatorIdx] : null
        const reviewerId = reviewerIdx != null && reviewerIds[reviewerIdx] ? reviewerIds[reviewerIdx] : null
        const etaDays = annotatorIdx != null && annotatorAssignments[annotatorIdx]?.eta_days != null ? annotatorAssignments[annotatorIdx].eta_days : null
        const dueAt = etaDays != null ? new Date(now.getTime() + etaDays * 86400 * 1000).toISOString() : null
        await api(`/tasks/${t.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            claimed_by_id: annotatorId,
            assigned_reviewer_id: reviewerId,
            status: annotatorId ? 'in_progress' : undefined,
            due_at: dueAt,
          }),
        }).catch(() => {})
      }
      await api(`/projects/${createdProjectId}/create-default-workflow`, { method: 'POST' }).catch(() => {})
      navigate(`/projects/${createdProjectId}`)
    } catch (err) {
      setError(err.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const addAttribute = () => setAttributes((a) => [...a, { name: '', type: 'free_text', options: '' }])
  const userDisplay = (u) => (u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email).trim() || u.email
  const updateAttribute = (i, field, value) => setAttributes((a) => {
    const next = [...a]
    next[i] = { ...next[i], [field]: value }
    return next
  })

  return (
    <>
      <h1 className="page-title">New Project</h1>
      <p className="page-desc">Workflow: Start → Data Import → Configure Labels → Assign Annotator → Send for Annotation</p>

      <div className="section">
        <div className="wizard-steps">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`btn ${i === step ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStep(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="card wizard-card wizard-card--large">
            <h4 className="wizard-card-title">1. Start</h4>
            <p className="wizard-card-meta">Workspace, project name, description, and pipeline template.</p>
            <p className="wizard-card-meta project-id-note">
              <strong>Project ID:</strong> Auto-generated (e.g. PRJ-00001) when you create the project.
            </p>
            {error && <div className="login-error">{error}</div>}
            <label className="form-label">Workspace</label>
            <select
              value={form.workspace_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, workspace_id: e.target.value ? parseInt(e.target.value, 10) : null }))}
              className="form-input"
            >
              <option value="">Select workspace</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <label className="form-label">Project name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Project name" />
            <label className="form-label">Description</label>
            <textarea className="form-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} />
            <label className="form-label">Pipeline template</label>
            <select className="form-input" value={form.pipeline_template} onChange={(e) => setForm((f) => ({ ...f, pipeline_template: e.target.value }))}>
              <option value="default">Default (L1 → Review → Done)</option>
              <option value="skip_review">Skip review</option>
            </select>
            <div className="wizard-actions-row">
              <button type="button" className="btn btn-primary" onClick={handleCreateProject} disabled={loading}>
                {loading ? 'Creating…' : 'Create project & continue'}
              </button>
            </div>
          </div>
        )}

        {step === 1 && createdProjectId && createdProjectRef && (
          <div className="card wizard-card wizard-card--large">
            <h4 className="wizard-card-title">2. Data Import</h4>
            <p className="wizard-card-meta">Upload media or paste text. All formats supported — images, video, audio, documents.</p>
            <div className="project-id-badge">
              <strong>Project ID:</strong> <code>{createdProjectRef.external_id || `PRJ-${createdProjectId}`}</code>
            </div>

            <div className="dropzone-wrap">
              <div
                className={`dropzone ${dragActive ? 'dropzone-active' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <input
                  type="file"
                  multiple
                  accept="*"
                  onChange={(e) => processNewFiles(e.target.files || [])}
                  className="dropzone-input"
                />
                <div className="dropzone-icon" aria-hidden>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="dropzone-title">Drop files here or click to browse</p>
                <p className="dropzone-hint">
                  Accepts multiple data formats. Images: JPG, PNG, GIF, WebP, BMP, SVG, TIFF. Video: MP4, WebM, MOV, AVI, MKV. Audio: MP3, WAV, OGG, M4A, AAC. Documents &amp; data: TXT, CSV, JSON, XML, HTML, PDF. Paste text below for line-by-line items. Large files up to 500 MB supported.
                </p>
                {metricsLoading && (
                  <>
                    <p className="dropzone-loading">Reading file metrics (large files may take a moment)…</p>
                    <div className="progress-bar" style={{ width: '100%', maxWidth: 280 }}>
                      <div className="progress-bar-fill progress-bar-indeterminate" style={{ width: '40%' }} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <h5 className="wizard-subsection">Uploaded files</h5>
            {fileMetricsList.length === 0 ? (
              <p className="empty">No files yet. Upload above or paste text below.</p>
            ) : (
              <div className="file-metrics-table-wrap">
                <table className="file-metrics-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Metrics</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileMetricsList.map((m) => (
                      <tr key={m.id}>
                        <td title={m.name}>{m.name}</td>
                        <td>{m.extension || m.type}</td>
                        <td>{m.sizeFormatted}</td>
                        <td>{m.dimensions || m.durationFormatted || '—'}</td>
                        <td>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeFileMetric(m.id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <label className="form-label">Or paste text (one line = one task)</label>
            <textarea
              className="form-input form-input--textarea"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste text here…"
              rows={4}
            />

            <h5 className="wizard-subsection">Data insight</h5>
            {dataInsight ? (
              <div className="data-insight-card">
                <div className="data-insight-stat">
                  <span className="data-insight-value">{dataInsight.total}</span>
                  <span className="data-insight-label">Total items</span>
                </div>
                <div className="data-insight-breakdown">
                  {Object.entries(dataInsight.byType || {}).map(([k, v]) => (
                    <span key={k} className="data-insight-tag">{k}: {v}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="empty">Upload files or paste text to see insight.</p>
            )}

            <div className="wizard-actions-row">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>Next: Configure Labels</button>
            </div>
          </div>
        )}

        {step === 2 && createdProjectId && createdProjectRef && (
          <div className="card wizard-card wizard-card--large">
            <h4 className="wizard-card-title">3. Configure annotation attributes</h4>
            <p className="wizard-card-meta">Define the fields annotators will fill: e.g. animal name (select), description (text), checkboxes, numbers, dates.</p>
            <div className="project-id-badge">
              <strong>Project ID:</strong> <code>{createdProjectRef.external_id || `PRJ-${createdProjectId}`}</code>
            </div>

            <div className="attributes-config">
              {attributes.map((a, i) => (
                <div key={i} className="attribute-row">
                  <input
                    className="form-input form-input--name"
                    value={a.name}
                    onChange={(e) => updateAttribute(i, 'name', e.target.value)}
                    placeholder="Attribute name"
                  />
                  <select
                    className="form-input form-input--type"
                    value={a.type}
                    onChange={(e) => updateAttribute(i, 'type', e.target.value)}
                  >
                    <option value="free_text">Free text</option>
                    <option value="textarea">Long text (textarea)</option>
                    <option value="single_select">Single select</option>
                    <option value="multi_select">Multi select</option>
                    <option value="checkbox">Checkbox (yes/no)</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="url">URL</option>
                    <option value="email">Email</option>
                    <option value="color_identifier">Color identifier</option>
                  </select>
                  {(a.type === 'single_select' || a.type === 'color_identifier' || a.type === 'multi_select') && (
                    <input
                      className="form-input form-input--options"
                      value={a.options ?? ''}
                      onChange={(e) => updateAttribute(i, 'options', e.target.value)}
                      placeholder={a.type === 'color_identifier' ? 'Colors (comma-separated)' : 'Options (comma-separated)'}
                    />
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-add-attr" onClick={addAttribute}>+ Add attribute</button>
            </div>

            <div className="wizard-actions-row">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Next: Assign Annotators</button>
            </div>
          </div>
        )}

        {step === 3 && createdProjectId && (
          <div className="card wizard-card wizard-card--large">
            <h4 className="wizard-card-title">4. Assign Annotators</h4>
            <p className="wizard-card-meta">Select multiple annotators. Work is distributed by the percentage you set (default: equal). Total must be 100%.</p>
            {createdProjectRef?.external_id && (
              <div className="project-id-badge"><strong>Project ID:</strong> <code>{createdProjectRef.external_id}</code></div>
            )}
            <div className="wizard-assign-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.open(`${window.location.origin}${window.location.pathname.replace(/\/projects\/new.*$/, '')}/users`, '_blank')}>User Management</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadAnnotatorsAndReviewers}>Refresh list</button>
            </div>

            <label className="form-label">Select annotators (multi-select)</label>
            {annotatorUsers.length === 0 && (
              <p className="meta assign-hint">No annotators found. Create users with Annotator role in User Management, then Refresh list.</p>
            )}
            <div className="assign-multiselect-wrap">
              <button
                type="button"
                className="assign-multiselect-trigger form-input"
                onClick={() => setAssignDropdownOpen((o) => ({ ...o, annotator: !o.annotator }))}
                aria-expanded={assignDropdownOpen.annotator}
              >
                {annotatorAssignments.length ? `${annotatorAssignments.length} selected` : 'Click to select annotators…'}
              </button>
              {assignDropdownOpen.annotator && (
                <div className="assign-multiselect-dropdown">
                  {annotatorUsers.map((u) => {
                    const selected = annotatorAssignments.some((a) => a.id === u.id)
                    return (
                      <label key={u.id} className="assign-multiselect-option">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            if (selected) {
                              const stillSelected = annotatorAssignments.filter((a) => a.id !== u.id).map((a) => annotatorUsers.find((x) => x.id === a.id)).filter(Boolean)
                              setAnnotatorSelection(stillSelected)
                            } else {
                              const currentUsers = annotatorAssignments.map((a) => annotatorUsers.find((x) => x.id === a.id)).filter(Boolean)
                              setAnnotatorSelection([...currentUsers, u])
                            }
                          }}
                        />
                        <span>{userDisplay(u)}</span>
                        {u.email && <span className="assign-option-email">{u.email}</span>}
                      </label>
                    )
                  })}
                  <button type="button" className="btn btn-secondary btn-sm assign-dropdown-close" onClick={() => setAssignDropdownOpen((o) => ({ ...o, annotator: false }))}>Done</button>
                </div>
              )}
            </div>

            {annotatorAssignments.length > 0 && (
              <>
                <h5 className="wizard-subsection">Distribution (total must be 100%)</h5>
                <div className="assign-table-wrap">
                  <table className="assign-table">
                    <thead>
                      <tr>
                        <th>Annotator</th>
                        <th>% of tasks</th>
                        <th>ETA (working days)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {annotatorAssignments.map((a, idx) => (
                        <tr key={a.id}>
                          <td>{a.name}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              className="form-input assign-pct-input"
                              value={a.percent}
                              onChange={(e) => updateAnnotatorPercent(idx, e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              className="form-input assign-pct-input"
                              placeholder="Days"
                              value={a.eta_days ?? ''}
                              onChange={(e) => updateAnnotatorEta(idx, e.target.value)}
                            />
                          </td>
                          <td>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeAnnotator(idx)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!annotatorTotalValid && (
                  <p className="assign-total-error">Total: {annotatorTotal.toFixed(1)}% — must equal 100%</p>
                )}
                {annotatorTotalValid && annotatorAssignments.length > 0 && (
                  <p className="assign-total-ok">Total: 100%</p>
                )}
              </>
            )}

            <div className="wizard-actions-row">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>Next: Assign Reviewers</button>
            </div>
          </div>
        )}

        {step === 4 && createdProjectId && (
          <div className="card wizard-card wizard-card--large">
            <h4 className="wizard-card-title">5. Assign Reviewers</h4>
            <p className="wizard-card-meta">Select multiple reviewers. Work is distributed by the percentage you set (default: equal). Total must be 100%.</p>
            {createdProjectRef?.external_id && (
              <div className="project-id-badge"><strong>Project ID:</strong> <code>{createdProjectRef.external_id}</code></div>
            )}
            <div className="wizard-assign-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.open(`${window.location.origin}${window.location.pathname.replace(/\/projects\/new.*$/, '')}/users`, '_blank')}>User Management</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadAnnotatorsAndReviewers}>Refresh list</button>
            </div>

            <label className="form-label">Select reviewers (multi-select)</label>
            {reviewerUsers.length === 0 && (
              <p className="meta assign-hint">No reviewers found. Create users with Reviewer role in User Management, then Refresh list.</p>
            )}
            <div className="assign-multiselect-wrap">
              <button
                type="button"
                className="assign-multiselect-trigger form-input"
                onClick={() => setAssignDropdownOpen((o) => ({ ...o, reviewer: !o.reviewer }))}
                aria-expanded={assignDropdownOpen.reviewer}
              >
                {reviewerAssignments.length ? `${reviewerAssignments.length} selected` : 'Click to select reviewers…'}
              </button>
              {assignDropdownOpen.reviewer && (
                <div className="assign-multiselect-dropdown">
                  {reviewerUsers.map((u) => {
                    const selected = reviewerAssignments.some((a) => a.id === u.id)
                    return (
                      <label key={u.id} className="assign-multiselect-option">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            if (selected) {
                              const stillSelected = reviewerAssignments.filter((a) => a.id !== u.id).map((a) => reviewerUsers.find((x) => x.id === a.id)).filter(Boolean)
                              setReviewerSelection(stillSelected)
                            } else {
                              const currentUsers = reviewerAssignments.map((a) => reviewerUsers.find((x) => x.id === a.id)).filter(Boolean)
                              setReviewerSelection([...currentUsers, u])
                            }
                          }}
                        />
                        <span>{userDisplay(u)}</span>
                        {u.email && <span className="assign-option-email">{u.email}</span>}
                      </label>
                    )
                  })}
                  <button type="button" className="btn btn-secondary btn-sm assign-dropdown-close" onClick={() => setAssignDropdownOpen((o) => ({ ...o, reviewer: false }))}>Done</button>
                </div>
              )}
            </div>

            {reviewerAssignments.length > 0 && (
              <>
                <h5 className="wizard-subsection">Distribution (total must be 100%)</h5>
                <div className="assign-table-wrap">
                  <table className="assign-table">
                    <thead>
                      <tr>
                        <th>Reviewer</th>
                        <th>% of tasks</th>
                        <th>ETA (working days)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewerAssignments.map((a, idx) => (
                        <tr key={a.id}>
                          <td>{a.name}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              className="form-input assign-pct-input"
                              value={a.percent}
                              onChange={(e) => updateReviewerPercent(idx, e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              className="form-input assign-pct-input"
                              placeholder="Days"
                              value={a.eta_days ?? ''}
                              onChange={(e) => updateReviewerEta(idx, e.target.value)}
                            />
                          </td>
                          <td>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeReviewer(idx)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!reviewerTotalValid && (
                  <p className="assign-total-error">Total: {reviewerTotal.toFixed(1)}% — must equal 100%</p>
                )}
                {reviewerTotalValid && reviewerAssignments.length > 0 && (
                  <p className="assign-total-ok">Total: 100%</p>
                )}
              </>
            )}

            <div className="wizard-actions-row">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(5)}>Next: Send</button>
            </div>
          </div>
        )}

        {step === 5 && createdProjectId && (
          <div className="card wizard-card wizard-card--large">
            <h4 className="wizard-card-title">6. Send for Annotation</h4>
            <p className="wizard-card-meta">Activate project, create batch from your data, and start the workflow. Tasks are assigned by the percentages you set.</p>
            {createdProjectRef?.external_id && (
              <div className="project-id-badge"><strong>Project ID:</strong> <code>{createdProjectRef.external_id}</code></div>
            )}
            {error && <div className="login-error">{error}</div>}
            <div className="wizard-actions-row">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(4)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={handleSendForAnnotation} disabled={loading || (annotatorAssignments.length > 0 && !annotatorTotalValid) || (reviewerAssignments.length > 0 && !reviewerTotalValid)}>
                {loading ? 'Sending…' : 'Send for Annotation'}
              </button>
            </div>
          </div>
        )}

        {step >= 1 && !createdProjectId && (
          <div className="card wizard-card">
            <p className="wizard-card-meta">Complete step 1 (Start) to create the project first. Project ID will be auto-generated and saved.</p>
            <button type="button" className="btn btn-primary" onClick={() => setStep(0)}>Go to Step 1</button>
          </div>
        )}
      </div>
    </>
  )
}
