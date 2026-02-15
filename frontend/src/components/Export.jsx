import { useState, useEffect } from 'react'
import { api } from '../api'

export function Export() {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api('/projects').then((p) => setProjects(Array.isArray(p) ? p : [])).catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([])
      return
    }
    setLoading(true)
    api(`/tasks?project_id=${selectedProjectId}`)
      .then(async (taskList) => {
        const list = Array.isArray(taskList) ? taskList : []
        const withAnnotations = await Promise.all(
          list.map(async (t) => {
            try {
              const anns = await api(`/tasks/${t.id}/annotations`)
              return { ...t, annotations: Array.isArray(anns) ? anns : [] }
            } catch {
              return { ...t, annotations: [] }
            }
          })
        )
        setTasks(withAnnotations)
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [selectedProjectId])

  const handleExportJson = () => {
    const data = { project_id: parseInt(selectedProjectId, 10), exported_at: new Date().toISOString(), tasks }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `annotations-project-${selectedProjectId}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <h1 className="page-title">Result › Bulk Export</h1>
      <p className="page-desc">Export annotations for a project as JSON. Optionally send by email (configure in settings).</p>
      <div className="card" style={{ maxWidth: 560 }}>
        <label className="form-label">Project</label>
        <select
          className="form-input"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {selectedProjectId && (
          <>
            <p className="meta" style={{ marginTop: '0.5rem' }}>
              {loading ? 'Loading…' : `${tasks.length} task(s) with annotations`}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={handleExportJson} disabled={loading}>
                Export as JSON
              </button>
              <button type="button" className="btn btn-secondary" disabled title="Configure SMTP in settings to enable email export">
                Send by email (coming soon)
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
