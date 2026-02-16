import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNavForRole } from '../navConfig'
import { api } from '../api'

export function Home({ user, canOps }) {
  const [workspaces, setWorkspaces] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const effectiveRoles = canOps ? [user?.role, 'annotator', 'reviewer'].filter(Boolean) : (user?.role ? [user.role] : [])
  const navItems = getNavForRole(effectiveRoles).filter((item) => item.path !== '/')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [wsList, projList] = await Promise.all([
          api('/workspaces').catch(() => []),
          api('/projects').catch(() => []),
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
      <header className="home-hero" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Annotation Studio</h1>
        <p className="page-desc" style={{ maxWidth: 560, opacity: 0.95 }}>
          Enterprise data labeling for ML and LLM pipelines. Manage workspaces, projects, and annotations in one place.
        </p>
      </header>

      {readyForExport.length > 0 && (
        <div className="home-notification card" style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--accent)', background: 'var(--accent-dim)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Ready for export</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {readyForExport.length} project{readyForExport.length !== 1 ? 's' : ''} completed. Export from the Export tab.
          </p>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => navigate('/export')}>
            Open Export
          </button>
        </div>
      )}

      <section className="home-cards-section" style={{ marginBottom: '2.5rem' }}>
        <h2 className="home-section-title" style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Quick access
        </h2>
        <div className="home-cards-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '1rem',
        }}>
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              className="home-card-box card"
              onClick={() => navigate(item.path)}
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                padding: '1.25rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--card-bg)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(124, 58, 237, 0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = ''
                e.currentTarget.style.boxShadow = ''
              }}
            >
              <span className="home-card-label" style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                {item.label}
              </span>
              <span className="home-card-meta meta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Open →
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Simulation: no box, more realistic flow */}
      <section className="home-simulation-section" style={{
        marginBottom: '2.5rem',
        padding: '2rem 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div className="home-simulation-flow" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(0.5rem, 4vw, 2rem)',
          flexWrap: 'wrap',
        }}>
          <div style={{
            padding: '0.75rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(167, 139, 250, 0.15))',
            borderRadius: 12,
            border: '1px solid rgba(124, 58, 237, 0.35)',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}>
            Raw data
          </div>
          <div style={{
            width: 32,
            height: 2,
            background: 'linear-gradient(90deg, var(--accent), var(--accent-secondary))',
            animation: 'simPulse 1.5s ease-in-out infinite',
          }} />
          <div style={{
            padding: '0.75rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(167, 139, 250, 0.2))',
            borderRadius: 12,
            border: '1px solid rgba(124, 58, 237, 0.4)',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}>
            Annotation Studio
          </div>
          <div style={{
            width: 32,
            height: 2,
            background: 'linear-gradient(90deg, var(--accent-secondary), var(--success-color))',
            animation: 'simPulse 1.5s ease-in-out infinite 0.3s',
          }} />
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, var(--accent-secondary), var(--accent))',
            boxShadow: '0 0 30px var(--accent-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.95)',
            animation: 'subtleGlow 2.5s ease-in-out infinite',
          }}>
            MODEL
          </div>
          <div style={{
            width: 32,
            height: 2,
            background: 'linear-gradient(90deg, var(--success-color), rgba(45, 212, 191, 0.6))',
            animation: 'simPulse 1.5s ease-in-out infinite 0.6s',
          }} />
          <div style={{
            padding: '0.75rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.2), rgba(45, 212, 191, 0.1))',
            borderRadius: 12,
            border: '1px solid rgba(45, 212, 191, 0.4)',
            fontWeight: 600,
            fontSize: '0.9rem',
            color: 'var(--success-color)',
          }}>
            Trained model
          </div>
        </div>
        <p className="meta" style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Labeled data flows from Annotation Studio into your ML or LLM pipeline.
        </p>
      </section>

      <section className="home-recent">
        <h2 className="home-section-title" style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Recent projects
        </h2>
        {loading ? (
          <div className="loader"><div className="spinner" /><p>Loading…</p></div>
        ) : recentProjects.length === 0 ? (
          <p className="empty">No projects yet. Create one from the Project tab.</p>
        ) : (
          <div className="home-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {recentProjects.map((p) => (
              <div
                key={p.id}
                className="card"
                style={{ cursor: 'pointer', padding: '1.25rem' }}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <h4 style={{ marginTop: 0, marginBottom: '0.35rem' }}>{p.name}</h4>
                <p className="meta" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>{p.status}</p>
                {p.status === 'ready_for_export' && (
                  <span className="status-badge completed" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>Ready for export</span>
                )}
                <div className="progress-bar" style={{ marginTop: '0.5rem' }}>
                  <div className="progress-bar-fill" style={{ width: p.status === 'completed' || p.status === 'ready_for_export' ? '100%' : '40%' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        @keyframes simPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  )
}
