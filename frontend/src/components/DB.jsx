import { useState, useEffect } from 'react'
import { api } from '../api'

/** Simple relationship diagram: this table → related tables via FK columns */
function RelationDiagram({ tableName, relationList }) {
  if (!relationList?.length) return <p className="meta">No foreign keys.</p>
  return (
    <div className="db-diagram-wrap" style={{ marginTop: '0.5rem' }}>
      <pre className="db-diagram" style={{ fontSize: '0.85rem', overflow: 'auto', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
        {`  [ ${tableName} ]
       |
${relationList.map(({ table, column }) => `       |-- ${column} --> [ ${table} ]`).join('\n')}`}
      </pre>
    </div>
  )
}

export function DB() {
  const [tablesMeta, setTablesMeta] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [selectedTable, setSelectedTable] = useState('')
  const [tableData, setTableData] = useState({ rows: [], total: 0 })
  const [dataLoading, setDataLoading] = useState(false)
  const [page, setPage] = useState(0)
  const pageSize = 100

  const [error, setError] = useState(null)

  const loadTables = () => {
    setLoading(true)
    setError(null)
    api('/db/tables')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.tables ?? [])
        setTablesMeta(list)
        if (!list.length) setError('No tables returned. Ensure backend is running and you are logged in as Super Admin, Admin, or Ops Manager.')
        else if (list[0]?.name) setSelectedTable(list[0].name)
      })
      .catch((e) => {
        setTablesMeta([])
        setError(e?.message || 'Failed to load tables. Check backend and login (Ops/Admin only).')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTables()
  }, [])

  useEffect(() => {
    if (!selectedTable) {
      setTableData({ rows: [], total: 0 })
      return
    }
    setDataLoading(true)
    const offset = page * pageSize
    api(`/db/tables/${encodeURIComponent(selectedTable)}/data?limit=${pageSize}&offset=${offset}`)
      .then((res) => {
        setTableData({ rows: res.rows || [], total: res.total ?? 0 })
      })
      .catch(() => setTableData({ rows: [], total: 0 }))
      .finally(() => setDataLoading(false))
  }, [selectedTable, page])

  const toggleExpand = (name) => setExpanded((e) => ({ ...e, [name]: !e[name] }))

  return (
    <div className="page-container">
      <h1 className="page-title">DB</h1>
      <p className="page-desc">Inspect tables and data (Super Admin, Admin, Ops Manager). Expand a table for schema and relationships.</p>

      {loading ? (
        <div className="loader"><div className="spinner" /><p>Loading tables…</p></div>
      ) : (
        <div className="section">
          {error && (
            <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--danger, #dc2626)' }}>
              <p style={{ margin: 0, color: 'var(--text)' }}>{error}</p>
              <p className="meta" style={{ marginTop: '0.5rem' }}>Ensure the backend is running and you are logged in as Super Admin, Admin, or Ops Manager.</p>
              <button type="button" className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={loadTables}>Retry</button>
            </div>
          )}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Tables</h3>
                <p className="meta" style={{ marginTop: '0.25rem' }}>Click a table to expand schema. Select below to view data.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadTables}>Refresh</button>
            </div>
            <ul className="db-table-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tablesMeta.map((t) => (
                <li key={t.name} className="db-table-item" style={{ marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ textAlign: 'left', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => toggleExpand(t.name)}
                  >
                    <span><strong>{t.name}</strong></span>
                    <span>{expanded[t.name] ? '▼' : '▶'}</span>
                  </button>
                  {expanded[t.name] && (
                    <div className="db-schema-block" style={{ marginTop: '0.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                      <h5 style={{ marginTop: 0 }}>Schema</h5>
                      <table className="list-table" style={{ width: '100%', fontSize: '0.9rem' }}>
                        <thead>
                          <tr>
                            <th>Column</th>
                            <th>Type</th>
                            <th>Nullable</th>
                            <th>PK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(t.columns || []).map((c) => (
                            <tr key={c.name}>
                              <td><code>{c.name}</code></td>
                              <td>{c.type}</td>
                              <td>{c.nullable ? 'Yes' : 'No'}</td>
                              <td>{c.primary_key ? 'Yes' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <h5 style={{ marginTop: '1rem' }}>Relationships</h5>
                      <RelationDiagram tableName={t.name} relationList={t.relation_list} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3>Table data</h3>
            <p className="meta">Select a table to load its rows below.</p>
            <select
              className="form-input"
              value={selectedTable}
              onChange={(e) => { setSelectedTable(e.target.value); setPage(0) }}
              style={{ maxWidth: 320 }}
            >
              <option value="">— Select table —</option>
              {tablesMeta.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>

            {selectedTable && (
              <>
                {dataLoading ? (
                  <div className="loader" style={{ minHeight: 120 }}><div className="spinner" /><p>Loading…</p></div>
                ) : (
                  <>
                    <p className="meta" style={{ marginTop: '0.5rem' }}>
                      Showing {tableData.rows.length} of {tableData.total} row(s).
                      {tableData.total > pageSize && (
                        <span style={{ marginLeft: '0.5rem' }}>
                          Page {page + 1} —{' '}
                          <button type="button" className="link" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Prev</button>
                          {' · '}
                          <button type="button" className="link" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= tableData.total}>Next</button>
                        </span>
                      )}
                    </p>
                    <div className="list-table-wrap" style={{ overflow: 'auto', marginTop: '0.5rem' }}>
                      {tableData.rows.length === 0 ? (
                        <p className="meta">No rows.</p>
                      ) : (
                        <table className="list-table">
                          <thead>
                            <tr>
                              {Object.keys(tableData.rows[0]).map((k) => (
                                <th key={k}>{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.rows.map((row, i) => (
                              <tr key={i}>
                                {Object.values(row).map((v, j) => (
                                  <td key={j} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {v == null ? '—' : (typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v)).slice(0, 100)}{(typeof v === 'object' ? JSON.stringify(v) : String(v)).length > 100 ? '…' : ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
