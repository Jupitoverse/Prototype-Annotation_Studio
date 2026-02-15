import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [batches, setBatches] = useState([])
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const [proj, batchList, instList] = await Promise.all([
          api(`/projects/${id}`),
          api(`/batches?project_id=${id}`),
          api(`/activities/instances?project_id=${id}`).catch(() => []),
        ])
        if (!cancelled) {
          setProject(proj)
          setBatches(batchList)
          setInstances(instList)
        }
      } catch {
        if (!cancelled) setProject(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading || !project) {
    return <p className="empty">{loading ? 'Loading…' : 'Project not found.'}</p>
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/projects')}>← Projects</button>
        <h1 className="page-title" style={{ margin: 0 }}>{project.name}</h1>
      </div>
      <p className="page-desc">{project.description || 'No description'} · {project.status}</p>

      <div className="section">
        <h3>Orchestration flow</h3>
        <p className="meta">View and manage activity nodes for this project.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate(`/projects/${id}/flow`)}>Open flow</button>
        {instances.length > 0 && (
          <p className="meta" style={{ marginTop: '0.5rem' }}>{instances.length} node(s) in this project.</p>
        )}
      </div>

      <div className="section">
        <h3>Batches</h3>
        {batches.length === 0 ? (
          <p className="empty">No batches yet. Add batches via API or batch upload (coming in next steps).</p>
        ) : (
          <div className="home-grid">
            {batches.map((b) => (
              <div key={b.id} className="card">
                <h4>{b.name}</h4>
                <p className="meta">Batch ID {b.id}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
