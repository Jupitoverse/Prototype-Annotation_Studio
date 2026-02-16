/**
 * Role-based navigation. Each item is shown only to the listed roles.
 * First occurrence of each path wins. Use "Review Task" for the review workqueue.
 */
export const NAV_ITEMS = [
  // ----- All roles -----
  { path: '/', label: 'Home', roles: ['super_admin', 'admin', 'ops_manager', 'annotator', 'reviewer', 'guest'] },

  // ----- Ops + Reviewer: Review Task (must appear before other /review so reviewer sees it) -----
  { path: '/review', label: 'Review Task', roles: ['reviewer', 'super_admin', 'admin', 'ops_manager'] },

  // ----- Super Admin, Admin, Ops Manager -----
  { path: '/users', label: 'User Management', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/workspaces', label: 'Workspaces', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/projects', label: 'Projects', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/tasks', label: 'Tasks', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/tasks/annotator', label: 'Annotator tasks', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/tasks/reviewer', label: 'Reviewer tasks', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/insight', label: 'Insight', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/export', label: 'Export', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/db', label: 'DB', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/requests', label: 'Requests', roles: ['super_admin', 'admin', 'ops_manager', 'annotator'] },

  // ----- Annotator -----
  { path: '/assignment', label: 'Assignment', roles: ['annotator'] },
  { path: '/workqueue', label: 'Annotation Task', roles: ['annotator'] },

  // ----- Reviewer (additional; Review Task already above) -----
  { path: '/assignment', label: 'Assignment', roles: ['reviewer'] },
  { path: '/workqueue', label: 'Workqueue', roles: ['reviewer'] },
  { path: '/insight', label: 'Insight', roles: ['reviewer'] },

  // ----- Guest (read-only) -----
  { path: '/projects', label: 'Projects', roles: ['guest'] },
  { path: '/tasks', label: 'Tasks', roles: ['guest'] },
  { path: '/insight', label: 'Insight', roles: ['guest'] },
]

/** Get unique nav entries for role(s). Pass array to show Annotator+Reviewer tabs to Ops. First occurrence of each path wins. */
export function getNavForRole(roleOrRoles) {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : (roleOrRoles ? [roleOrRoles] : [])
  if (!roles.length) return []
  const seen = new Set()
  return NAV_ITEMS.filter((item) => {
    const allowed = item.roles.some((r) => roles.includes(r))
    if (!allowed) return false
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })
}
