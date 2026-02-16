import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  ops_manager: 'Operation Manager',
  annotator: 'Annotator',
  reviewer: 'Reviewer',
  guest: 'Guest',
  support_person: 'Support Person',
}

const AVAILABILITY_OPTIONS = ['100%', '75%', '50%', '25%']

const emptyForm = () => ({
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  password: '',
  mobile: '',
  role: 'annotator',
  availability: '100%',
  max_load: 50,
  workspace_ids: [],
})

export function UserManagement() {
  const [users, setUsers] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [filters, setFilters] = useState({ role: '', name_contains: '', email_contains: '', mobile_contains: '', availability: '' })
  const [sortBy, setSortBy] = useState('id')
  const [sortDir, setSortDir] = useState('asc')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.role) params.set('role', filters.role)
      const query = params.toString()
      const [uList, wList, rList] = await Promise.all([
        api(query ? `/users?${query}` : '/users'),
        api('/workspaces'),
        api('/users/roles').catch(() => []),
      ])
      const userList = Array.isArray(uList) ? uList : []
      setUsers(userList)
      setWorkspaces(Array.isArray(wList) ? wList : [])
      setRoles(Array.isArray(rList) ? rList : [])
    } catch (e) {
      setError(e.message || 'Failed to load users')
      setUsers([])
      setWorkspaces([])
    } finally {
      setLoading(false)
    }
  }, [filters.role])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setSuccessMessage('')
    setShowForm(true)
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({
      first_name: u.first_name ?? '',
      middle_name: u.middle_name ?? '',
      last_name: u.last_name ?? '',
      email: u.email ?? '',
      password: '',
      mobile: u.mobile ?? '',
      role: u.role ?? 'annotator',
      availability: u.availability ?? '100%',
      max_load: u.max_load ?? 50,
      workspace_ids: Array.isArray(u.workspace_ids) ? [...u.workspace_ids] : [],
    })
    setError('')
    setSuccessMessage('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm())
    setError('')
  }

  const updateField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const toggleWorkspace = (workspaceId) => {
    setForm((f) => {
      const ids = f.workspace_ids || []
      const next = ids.includes(workspaceId)
        ? ids.filter((id) => id !== workspaceId)
        : [...ids, workspaceId]
      return { ...f, workspace_ids: next }
    })
  }

  const validateForm = () => {
    if (!form.first_name?.trim()) return 'First name is required'
    if (!form.email?.trim()) return 'Email is required'
    if (!editing && !form.password?.trim()) return 'Password is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const body = {
          first_name: form.first_name.trim(),
          middle_name: form.middle_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim() || null,
          role: form.role,
          availability: form.availability || '100%',
          max_load: typeof form.max_load === 'number' ? form.max_load : parseInt(form.max_load, 10) || 50,
          workspace_ids: form.workspace_ids || [],
        }
        if (form.password?.trim()) body.password = form.password
        await api(`/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        setSuccessMessage('User updated successfully.')
        setTimeout(() => { closeForm(); load(); setSuccessMessage('') }, 800)
      } else {
        const password = (form.password && String(form.password).trim()) || ''
        if (!password) {
          setError('Password is required')
          setSaving(false)
          return
        }
        const created = await api('/users', {
          method: 'POST',
          body: JSON.stringify({
            first_name: form.first_name.trim(),
            middle_name: (form.middle_name && form.middle_name.trim()) || '',
            last_name: (form.last_name && form.last_name.trim()) || '',
            email: form.email.trim(),
            password,
            mobile: (form.mobile && form.mobile.trim()) || null,
            role: form.role || 'annotator',
            availability: form.availability || '100%',
            max_load: typeof form.max_load === 'number' ? form.max_load : parseInt(form.max_load, 10) || 50,
            workspace_ids: Array.isArray(form.workspace_ids) ? form.workspace_ids : [],
          }),
        })
        setSuccessMessage(`User created successfully. User ID: ${created.userid || created.external_id || created.id}`)
        closeForm()
        load()
        setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch (e) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const workspaceNames = (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return '—'
    return ids
      .map((id) => workspaces.find((w) => w.id === id)?.name)
      .filter(Boolean)
      .join(', ') || '—'
  }

  const exportAllUsers = () => {
    const data = users.map((u) => ({
      user_id: u.external_id || u.id,
      first_name: u.first_name,
      middle_name: u.middle_name,
      last_name: u.last_name,
      full_name: u.full_name,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      workspace_ids: u.workspace_ids,
      workspace_access: workspaceNames(u.workspace_ids),
      is_active: u.is_active,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => setFilters({ role: '', name_contains: '', email_contains: '', mobile_contains: '', availability: '' })
  const hasFilters = filters.role || filters.name_contains || filters.email_contains || filters.mobile_contains || filters.availability

  let filteredUsers = users
  if (filters.role) filteredUsers = filteredUsers.filter((u) => u.role === filters.role)
  if (filters.name_contains) {
    const q = filters.name_contains.toLowerCase()
    filteredUsers = filteredUsers.filter(
      (u) =>
        (u.first_name || '').toLowerCase().includes(q) ||
        (u.last_name || '').toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.userid || '').toLowerCase().includes(q) ||
        (u.external_id || '').toLowerCase().includes(q)
    )
  }
  if (filters.email_contains) {
    const q = filters.email_contains.toLowerCase()
    filteredUsers = filteredUsers.filter((u) => (u.email || '').toLowerCase().includes(q))
  }
  if (filters.mobile_contains) {
    const q = filters.mobile_contains.toLowerCase()
    filteredUsers = filteredUsers.filter((u) => (u.mobile || '').toLowerCase().includes(q))
  }
  if (filters.availability) filteredUsers = filteredUsers.filter((u) => (u.availability || '') === filters.availability)

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let va = a[sortBy] ?? a.id ?? ''
    let vb = b[sortBy] ?? b.id ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
    va = String(va).toLowerCase()
    vb = String(vb).toLowerCase()
    if (sortDir === 'asc') return va.localeCompare(vb)
    return vb.localeCompare(va)
  })

  const handleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else setSortBy(col)
  }

  const downloadCsv = () => {
    const headers = ['User ID', 'First name', 'Last name', 'Email', 'Mobile', 'Role', 'Availability', 'Max load']
    const rows = sortedUsers.map((u) => [
      u.userid || u.external_id || u.id,
      u.first_name ?? '',
      u.last_name ?? '',
      u.email ?? '',
      u.mobile ?? '',
      u.role ?? '',
      u.availability ?? '',
      u.max_load ?? '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sendEmailToUsers = () => {
    const emails = sortedUsers.map((u) => u.email).filter(Boolean)
    if (emails.length === 0) return
    window.location.href = `mailto:${emails.join(',')}?subject=Annotation%20Studio`
  }

  return (
    <div className="list-page">
      <aside className="list-filter-panel">
        <h3>
          FILTER BY
          {hasFilters && (
            <button type="button" className="filter-clear" onClick={clearFilters}>
              Clear All
            </button>
          )}
        </h3>
        <div className="filter-section">
          <label>Name or email</label>
          <input
            type="text"
            placeholder="Search by name, email, User ID…"
            value={filters.name_contains}
            onChange={(e) => setFilters((f) => ({ ...f, name_contains: e.target.value }))}
          />
        </div>
        <div className="filter-section">
          <label>Role</label>
          <select
            value={filters.role}
            onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="">All roles</option>
            {(roles.length ? roles : Object.entries(ROLE_LABELS).map(([id, label]) => ({ id, label }))).map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-section">
          <label>Email contains</label>
          <input
            type="text"
            placeholder="Filter by email…"
            value={filters.email_contains}
            onChange={(e) => setFilters((f) => ({ ...f, email_contains: e.target.value }))}
          />
        </div>
        <div className="filter-section">
          <label>Mobile contains</label>
          <input
            type="text"
            placeholder="Filter by mobile…"
            value={filters.mobile_contains}
            onChange={(e) => setFilters((f) => ({ ...f, mobile_contains: e.target.value }))}
          />
        </div>
        <div className="filter-section">
          <label>Availability</label>
          <select
            value={filters.availability}
            onChange={(e) => setFilters((f) => ({ ...f, availability: e.target.value }))}
          >
            <option value="">All</option>
            {AVAILABILITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </aside>

      <div className="list-content">
        <div className="list-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="list-title">User list</h1>
            <span className="list-results">{sortedUsers.length} user{sortedUsers.length !== 1 ? 's' : ''}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            title="Add new user"
          >
            <span aria-hidden style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
            Add user
          </button>
        </div>

        {successMessage && (
          <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
            <p style={{ margin: 0, color: 'var(--accent)', fontWeight: 600 }}>{successMessage}</p>
          </div>
        )}

        {error && !showForm && (
          <div className="login-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <button type="button" className="btn btn-secondary" onClick={downloadCsv} disabled={sortedUsers.length === 0}>
            Download CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportAllUsers} disabled={users.length === 0}>
            Download JSON
          </button>
          <button type="button" className="btn btn-secondary" onClick={sendEmailToUsers} disabled={sortedUsers.length === 0} title="Opens mail client with selected users' emails">
            Send email
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                const res = await api('/users/seed-dummy', { method: 'POST' })
                setSuccessMessage(res?.message || `Created ${res?.created ?? 0} dummy user(s).`)
                load()
                setTimeout(() => setSuccessMessage(''), 4000)
              } catch (e) {
                setError(e.message || 'Seed failed')
              }
            }}
          >
            Seed dummy users (2–3 per role)
          </button>
        </div>

        {loading ? (
          <div className="loader">
            <div className="spinner" />
            <p>Loading users…</p>
          </div>
        ) : (
          <div className="list-table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  <th><button type="button" className="link table-sort" onClick={() => handleSort('userid')}>User ID {sortBy === 'userid' && (sortDir === 'asc' ? '↑' : '↓')}</button></th>
                  <th><button type="button" className="link table-sort" onClick={() => handleSort('first_name')}>First name {sortBy === 'first_name' && (sortDir === 'asc' ? '↑' : '↓')}</button></th>
                  <th>Middle name</th>
                  <th><button type="button" className="link table-sort" onClick={() => handleSort('last_name')}>Last name {sortBy === 'last_name' && (sortDir === 'asc' ? '↑' : '↓')}</button></th>
                  <th><button type="button" className="link table-sort" onClick={() => handleSort('email')}>Email {sortBy === 'email' && (sortDir === 'asc' ? '↑' : '↓')}</button></th>
                  <th><button type="button" className="link table-sort" onClick={() => handleSort('mobile')}>Mobile {sortBy === 'mobile' && (sortDir === 'asc' ? '↑' : '↓')}</button></th>
                  <th><button type="button" className="link table-sort" onClick={() => handleSort('role')}>Role {sortBy === 'role' && (sortDir === 'asc' ? '↑' : '↓')}</button></th>
                  <th><button type="button" className="link table-sort" onClick={() => handleSort('availability')}>Availability {sortBy === 'availability' && (sortDir === 'asc' ? '↑' : '↓')}</button></th>
                  <th><button type="button" className="link table-sort" onClick={() => handleSort('max_load')}>Max load {sortBy === 'max_load' && (sortDir === 'asc' ? '↑' : '↓')}</button></th>
                  <th>Workspace access</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="list-empty-cell">
                      No users found. Adjust filters or seed dummy users.
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <code className="user-id-cell">{u.userid || u.external_id || `#${u.id}`}</code>
                      </td>
                      <td>{u.first_name ?? '—'}</td>
                      <td>{u.middle_name ?? '—'}</td>
                      <td>{u.last_name ?? '—'}</td>
                      <td>{u.email}</td>
                      <td>{u.mobile ?? '—'}</td>
                      <td>
                        <span className="badge badge-role">{ROLE_LABELS[u.role] ?? u.role}</span>
                      </td>
                      <td>{u.availability ?? '—'}</td>
                      <td>{u.max_load ?? '—'}</td>
                      <td className="workspace-cell" title={workspaceNames(u.workspace_ids)}>
                        {workspaceNames(u.workspace_ids)}
                      </td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="user-form-overlay" onClick={(e) => e.target === e.currentTarget && closeForm()}>
          <div className="card user-form-card">
            <h3 className="user-form-title">{editing ? 'Edit user' : 'Create user'}</h3>
            <p className="user-form-meta">
              {editing
                ? 'Update profile details. User ID cannot be changed.'
                : 'User ID is generated when you click &quot;Create user&quot; after filling required fields.'}
            </p>
            <form onSubmit={handleSubmit} className="user-form">
              {error && (
                <div className="login-error" style={{ marginBottom: '1rem' }}>
                  {error}
                </div>
              )}
              <div className="user-form-grid">
                <div className="user-form-field user-form-field-required">
                  <label className="form-label">First name</label>
                  <input
                    className="form-input"
                    value={form.first_name}
                    onChange={(e) => updateField('first_name', e.target.value)}
                    placeholder="First name"
                    required
                  />
                </div>
                <div className="user-form-field">
                  <label className="form-label">Middle name</label>
                  <input
                    className="form-input"
                    value={form.middle_name}
                    onChange={(e) => updateField('middle_name', e.target.value)}
                    placeholder="Middle name"
                  />
                </div>
                <div className="user-form-field">
                  <label className="form-label">Last name</label>
                  <input
                    className="form-input"
                    value={form.last_name}
                    onChange={(e) => updateField('last_name', e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="user-form-field user-form-field-full">
                <label className="form-label">User ID</label>
                <input
                  className="form-input form-input-readonly"
                  value={editing?.userid ?? editing?.external_id ?? '—'}
                  readOnly
                  disabled
                  placeholder="Generated when you click Create user"
                />
                {!editing && (
                  <p className="form-hint">Assigned after you fill required fields and click Create user.</p>
                )}
              </div>
              <div className="user-form-field user-form-field-required user-form-field-full">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="user@example.com"
                  disabled={!!editing}
                  required
                />
                {editing && <p className="form-hint">Email cannot be changed.</p>}
              </div>
              {!editing && (
                <div className="user-form-field user-form-field-required user-form-field-full">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Password"
                    required
                  />
                </div>
              )}
              {editing && (
                <div className="user-form-field user-form-field-full">
                  <label className="form-label">New password (optional)</label>
                  <input
                    type="password"
                    className="form-input"
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </div>
              )}
              <div className="user-form-field user-form-field-full">
                <label className="form-label">Mobile (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.mobile}
                  onChange={(e) => updateField('mobile', e.target.value)}
                  placeholder="e.g. +1 9876543210"
                />
              </div>
              <div className="user-form-field user-form-field-full">
                <label className="form-label">Role</label>
                <select
                  className="form-input"
                  value={form.role}
                  onChange={(e) => updateField('role', e.target.value)}
                >
                  {Object.entries(ROLE_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="user-form-field user-form-field-full">
                <label className="form-label">Availability</label>
                <select
                  className="form-input"
                  value={form.availability || '100%'}
                  onChange={(e) => updateField('availability', e.target.value)}
                >
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="user-form-field user-form-field-full">
                <label className="form-label">Max load</label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  className="form-input"
                  value={form.max_load ?? 50}
                  onChange={(e) => updateField('max_load', parseInt(e.target.value, 10) || 50)}
                />
                <p className="form-hint">Maximum tasks/items this user can handle.</p>
              </div>
              <div className="user-form-field user-form-field-full">
                <label className="form-label">Workspace access</label>
                <div className="workspace-checkboxes">
                  {workspaces.length === 0 ? (
                    <p className="form-hint">No workspaces. Create workspaces first.</p>
                  ) : (
                    workspaces.map((w) => (
                      <label key={w.id} className="workspace-checkbox">
                        <input
                          type="checkbox"
                          checked={(form.workspace_ids || []).includes(w.id)}
                          onChange={() => toggleWorkspace(w.id)}
                        />
                        <span>{w.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="user-form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update' : 'Create user'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
