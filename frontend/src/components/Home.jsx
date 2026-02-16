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
          setWorkspaces(Array.isArray(wsList) ? wsList : [])
          setProjects(Array.isArray(projList) ? projList : [])
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
  const readyForExport = projects.filter((p) => p.status === 'ready_for_export')

  return (
    <>
      <div className="home-landing" style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
        {/* Left: hero + quick actions */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <header className="home-hero">
            <h1 className="page-title">Annotation Studio</h1>
            <p className="page-desc">Enterprise data labeling for ML and LLM pipelines. Create projects, manage assignments, and track progress.</p>
          </header>

          {readyForExport.length > 0 && (
            <div className="home-notification card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--accent)', background: 'var(--accent-dim)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Ready for export</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {readyForExport.length} project{readyForExport.length !== 1 ? 's' : ''} completed and ready for export.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                {readyForExport.map((p) => (
                  <button key={p.id} type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/export')}>
                    {p.name} — Export
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="section">
            <h3>Quick actions</h3>
            <div className="home-grid" style={{ marginBottom: 0 }}>
              {canOps && (
                <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/projects/new')}>
                  <h4>Create Project</h4>
                  <p className="meta">New annotation project</p>
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
                <p className="meta">Annotate · Review</p>
                <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>Open</button>
              </div>
              {canOps && (
                <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/export')}>
                  <h4>Export</h4>
                  <p className="meta">JSON or ZIP</p>
                  <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>Export</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Data → Robotic brain simulation */}
        <div className="home-simulation-right" style={{ flex: '0 1 380px', minWidth: 280 }}>
          <div className="simulation-brain-wrap" style={{
            position: 'relative',
            padding: '1.5rem',
            background: 'linear-gradient(145deg, var(--bg-secondary) 0%, var(--bg-elevated) 100%)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            minHeight: 320,
          }}>
            <h4 style={{ marginTop: 0, marginBottom: '1rem', textAlign: 'center', fontSize: '1rem', color: 'var(--text-secondary)' }}>
              Data annotation → AI / ML
            </h4>
            {/* Falling data items (motion) */}
            <div className="sim-data-drops" style={{ position: 'absolute', top: 40, left: 0, right: 0, height: 120, overflow: 'hidden', pointerEvents: 'none' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="sim-dot"
                  style={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i % 3 === 0 ? 'var(--accent)' : i % 3 === 1 ? 'var(--accent-secondary)' : 'var(--success-color)',
                    left: `${10 + (i * 11)}%`,
                    top: -20,
                    animation: `simFall 2.5s ease-in-out ${i * 0.2}s infinite`,
                    opacity: 0.9,
                  }}
                />
              ))}
            </div>
            {/* Central "brain" node */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, var(--accent-secondary), var(--accent))',
              boxShadow: '0 0 40px var(--accent-glow), inset 0 0 30px rgba(255,255,255,0.1)',
              animation: 'subtleGlow 3s ease-in-out infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.95)', textAlign: 'center', padding: 8 }}>MODEL</span>
            </div>
            {/* Labels */}
            <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Labeled data
            </div>
            <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Trained model
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>Recent projects</h3>
        {loading ? (
          <div className="loader"><div className="spinner" /><p>Loading…</p></div>
        ) : recentProjects.length === 0 ? (
          <p className="empty">No projects yet. Create one to get started.</p>
        ) : (
          <div className="home-grid">
            {recentProjects.map((p) => (
              <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                <h4>{p.name}</h4>
                <p className="meta">{p.description || 'No description'} · {p.status}</p>
                {p.status === 'ready_for_export' && (
                  <span className="status-badge completed" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>Ready for export</span>
                )}
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: p.status === 'completed' || p.status === 'ready_for_export' ? '100%' : '40%' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes simFall {
          0% { transform: translateY(0) scale(1); opacity: 0.9; }
          45% { transform: translateY(90px) scale(1.2); opacity: 1; }
          50% { transform: translateY(100px) scale(0.3); opacity: 0.3; }
          55% { transform: translateY(90px) scale(1.2); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 0.9; }
        }
      `}</style>
    </>
  )
}
