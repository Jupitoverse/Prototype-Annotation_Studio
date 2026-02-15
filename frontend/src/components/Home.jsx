import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export function Home({ user, canOps }) {
  const [workspaces, setWorkspaces] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [wsList, projList] = await Promise.all([
          api('/workspaces'),
          api('/projects'),
        ])
        if (!cancelled) {
          setWorkspaces(wsList)
          setProjects(projList)
        }
      } catch {
        if (!cancelled) setProjects([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const recentProjects = projects.slice(0, 6)
  const taskCount = (p) => (p.batches?.length ? 0 : 0) // would need batch task count from API

  return (
    <>
      <h1 className="page-title">Home</h1>
      <p className="page-desc">Create projects, manage assignments, and track progress.</p>

      <div className="section">
        <h3>Quick actions</h3>
        <div className="home-grid" style={{ marginBottom: '1.5rem' }}>
          {canOps && (
            <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/projects/new')}>
              <h4>Create Project</h4>
              <p className="meta">New annotation project with workspace, dataset, and pipeline</p>
              <button type="button" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Create</button>
            </div>
          )}
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
            <h4>Projects</h4>
            <p className="meta">{projects.length} project(s)</p>
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>View all</button>
          </div>
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/workqueue')}>
            <h4>Workqueue</h4>
            <p className="meta">Operation Manager · Annotator · Reviewer</p>
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>Open</button>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>Recent projects</h3>
        {loading ? (
          <div className="loader">
            <div className="spinner" />
            <p>Loading…</p>
          </div>
        ) : recentProjects.length === 0 ? (
          <p className="empty">No projects yet. Create one to get started.</p>
        ) : (
          <div className="home-grid">
            {recentProjects.map((p) => (
              <div
                key={p.id}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <h4>{p.name}</h4>
                <p className="meta">{p.description || 'No description'} · {p.status}</p>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: p.status === 'completed' ? '100%' : '40%' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
