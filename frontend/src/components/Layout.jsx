import { NavLink, useLocation } from 'react-router-dom'
import { getNavForRole } from '../navConfig'

export function Layout({ user, logout, children }) {
  const location = useLocation()
  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    if (path === '/projects') return location.pathname === '/projects' || location.pathname.startsWith('/projects/')
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const effectiveRoles = user?.role && ['super_admin', 'admin', 'ops_manager'].includes(user.role)
    ? [user.role, 'annotator', 'reviewer']
    : (user?.role ? [user.role] : [])
  const navItems = getNavForRole(effectiveRoles)

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="app-header-logo">
          <span>◇</span>
          <span>Annotation Studio</span>
        </NavLink>
        <nav className="app-header-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path + item.label}
              to={item.path}
              className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
              title={item.sub || item.label}
            >
              {item.label}
              {item.sub && <span className="nav-link-sub">{item.sub}</span>}
            </NavLink>
          ))}
        </nav>
        <input type="search" className="app-header-search" placeholder="Search projects, tasks…" />
        <div className="app-header-actions">
          <span className="app-header-email">{user?.email}</span>
          <span className="badge badge-role">{user?.role?.replace('_', ' ')}</span>
          {user?.role !== 'guest' && (
            <button type="button" className="btn btn-secondary" onClick={logout}>Log out</button>
          )}
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
      <footer className="app-footer">
        Annotation Studio V1 — Enterprise data labeling with enhanced orchestration flow
      </footer>
    </div>
  )
}
