import { useState, useEffect } from 'react'
import JSZip from 'jszip'
import { api } from '../api'

export function Export() {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [zipLoading, setZipLoading] = useState(false)

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

  /** Option 1: JSON with metadata + image path/link only (no binary). For LLM/ML pipelines that reference assets by path or URL. */
  const handleExportJsonMetaAndPath = () => {
    const rows = tasks.map((t) => {
      const lastAnn = Array.isArray(t.annotations) && t.annotations.length ? t.annotations[t.annotations.length - 1] : null
      return {
        task_id: t.id,
        image_file: t.content?.file ?? null,
        image_url: t.content?.url ?? null,
        status: t.status,
        pipeline_stage: t.pipeline_stage,
        labels: lastAnn?.response ?? null,
        annotated_at: lastAnn?.created_at ?? null,
      }
    })
    const data = {
      project_id: parseInt(selectedProjectId, 10),
      exported_at: new Date().toISOString(),
      format: 'metadata_and_image_path',
      note: 'Image path/link only; no binary. Use for referencing assets in pipelines.',
      tasks: rows,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export-metadata-project-${selectedProjectId}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportFullJson = () => {
    const data = { project_id: parseInt(selectedProjectId, 10), exported_at: new Date().toISOString(), tasks }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `annotations-project-${selectedProjectId}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Option 2: ZIP with images + JSON. JSON references image filenames placed inside the zip. */
  const handleExportZip = async () => {
    setZipLoading(true)
    try {
      const zip = new JSZip()
      const rows = []
      for (const t of tasks) {
        const lastAnn = Array.isArray(t.annotations) && t.annotations.length ? t.annotations[t.annotations.length - 1] : null
        const fileName = t.content?.file || `task_${t.id}.jpg`
        rows.push({
          task_id: t.id,
          image_file: fileName,
          image_url: t.content?.url ?? null,
          status: t.status,
          pipeline_stage: t.pipeline_stage,
          labels: lastAnn?.response ?? null,
          annotated_at: lastAnn?.created_at ?? null,
        })
        if (t.content?.url) {
          try {
            const res = await fetch(t.content.url, { mode: 'cors' })
            if (res.ok) {
              const buf = await res.arrayBuffer()
              zip.file(fileName, buf)
            }
          } catch {
            // skip image if fetch fails (CORS or network)
          }
        }
      }
      const data = {
        project_id: parseInt(selectedProjectId, 10),
        exported_at: new Date().toISOString(),
        format: 'zip_with_images',
        note: 'Image files in this zip are referenced by image_file in tasks.',
        tasks: rows,
      }
      zip.file('annotations.json', JSON.stringify(data, null, 2))
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-project-${selectedProjectId}-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setZipLoading(false)
    }
  }

  return (
    <>
      <h1 className="page-title">Result › Bulk Export</h1>
      <p className="page-desc">Export annotations for a project. Ops / Admin / Super Admin: JSON (metadata + image path) or ZIP (images + JSON with referrable filenames).</p>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div>
                <strong>1. JSON (metadata + image path/link only)</strong>
                <p className="meta" style={{ marginTop: '0.25rem' }}>Metadata and image path or URL per task; no binary. Use for pipelines that reference assets by path.</p>
                <button type="button" className="btn btn-primary" onClick={handleExportJsonMetaAndPath} disabled={loading}>
                  Download JSON (metadata + paths)
                </button>
              </div>
              <div>
                <strong>2. ZIP (images + JSON)</strong>
                <p className="meta" style={{ marginTop: '0.25rem' }}>ZIP contains image files and annotations.json. JSON references image filenames inside the ZIP.</p>
                <button type="button" className="btn btn-primary" onClick={handleExportZip} disabled={loading || zipLoading} title="Fetches images from URLs; may fail for some CORS-restricted hosts">
                  {zipLoading ? 'Building ZIP…' : 'Download ZIP (images + JSON)'}
                </button>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleExportFullJson} disabled={loading}>
                  Export full JSON (raw)
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
