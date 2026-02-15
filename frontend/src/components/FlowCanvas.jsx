import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'

const NODE_SIZE = 52
const NODE_GAP = 140

export function FlowCanvas() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const [proj, instList] = await Promise.all([
          api(`/projects/${id}`),
          api(`/activities/instances?project_id=${id}`),
        ])
        if (!cancelled) {
          setProject(proj)
          setInstances(instList)
        }
      } catch {
        if (!cancelled) setInstances([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const getNodeStatusClass = (inst) => {
    if (inst.node_type === 'start' || inst.node_type === 'end') return inst.node_type
    if (inst.status === 'completed') return 'completed'
    if (inst.status === 'in_progress') return 'in_progress'
    if (inst.status === 'skipped') return 'skipped'
    if (inst.status === 'cancelled') return 'cancelled'
    return 'pending'
  }

  /** Display name for this sub-task in the Data Annotation workflow */
  const getNodeLabel = (inst) => {
    if (inst.payload && typeof inst.payload.label === 'string' && inst.payload.label.trim()) return inst.payload.label.trim()
    if (inst.spec && inst.spec.name) return inst.spec.name
    const type = inst.node_type || 'normal'
    const labels = { start: 'Start', end: 'End', manual: 'Manual Task', group: 'Group', skipped: 'Skipped', normal: 'Activity' }
    return labels[type] || type
  }

  // Horizontal layout: each node is a sub-task with name below
  const positions = instances.reduce((acc, inst, i) => {
    acc[inst.instance_uid] = { x: 60 + i * (NODE_SIZE + NODE_GAP), y: 100 }
    return acc
  }, {})

  if (loading || !project) {
    return (
      <div className="main-content">
        {loading ? (
          <div className="loader">
            <div className="spinner" />
            <p>Loading workflow…</p>
          </div>
        ) : (
          <p className="empty">Project not found.</p>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/projects/${id}`)}>← Project</button>
        <h1 className="page-title" style={{ margin: 0 }}>Workflow — {project.name}</h1>
      </div>
      <p className="page-desc">Data Annotation workflow: each node is a sub-task. Start → Configure → Assign → Annotate → Review → End.</p>

      <div className="flow-canvas" style={{ padding: '2rem', minHeight: '380px', position: 'relative' }}>
        {instances.length === 0 ? (
          <p className="empty">No activity nodes yet. Add nodes via Activity API or configure pipeline from project settings.</p>
        ) : (
          <>
            <svg width={instances.length * (NODE_SIZE + NODE_GAP) + 200} height={320} style={{ position: 'absolute', left: 0, top: 0 }} className="flow-edges">
              {instances.slice(0, -1).map((inst, i) => {
                const next = instances[i + 1]
                if (!next) return null
                const from = positions[inst.instance_uid]
                const to = positions[next.instance_uid]
                if (!from || !to) return null
                const half = NODE_SIZE / 2
                return (
                  <line
                    key={`edge-${inst.instance_uid}`}
                    x1={from.x + half}
                    y1={from.y + half}
                    x2={to.x + half}
                    y2={to.y + half}
                    stroke="#94a3b8"
                    strokeWidth="2.5"
                  />
                )
              })}
            </svg>
            <div style={{ position: 'relative', width: instances.length * (NODE_SIZE + NODE_GAP) + 200, height: 320 }}>
              {instances.map((inst) => {
                const pos = positions[inst.instance_uid] || { x: 0, y: 0 }
                const statusClass = getNodeStatusClass(inst)
                return (
                  <div
                    key={inst.instance_uid}
                    className="flow-node"
                    style={{ position: 'absolute', left: pos.x, top: pos.y }}
                    title={`${getNodeLabel(inst)} · ${inst.status}`}
                  >
                    <div className={`flow-node-circle ${statusClass}`}>
                      {inst.node_type === 'manual' ? '👤' : inst.node_type === 'start' ? '▶' : inst.node_type === 'end' ? '■' : inst.node_type === 'group' ? '⊡' : '○'}
                    </div>
                    <span className="flow-node-label" title={getNodeLabel(inst)}>{getNodeLabel(inst)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="flow-legend">
        <span><span className="flow-legend-dot" style={{ background: 'var(--node-completed)' }} /> Completed</span>
        <span><span className="flow-legend-dot" style={{ background: 'var(--node-in-progress)' }} /> In progress</span>
        <span><span className="flow-legend-dot" style={{ background: 'var(--node-pending)' }} /> Pending</span>
        <span><span className="flow-legend-dot" style={{ border: '2px double var(--node-skipped)' }} /> Skipped</span>
        <span><span className="flow-legend-dot" style={{ background: 'var(--accent)' }} /> Start / End</span>
        <span><span className="flow-legend-dot group" style={{ border: '2px double var(--accent)' }} /> Group / Child</span>
        <span><span className="flow-legend-dot" style={{ background: 'var(--accent-dim)', border: '2px solid var(--accent)' }} /> Manual</span>
      </div>
    </>
  )
}
