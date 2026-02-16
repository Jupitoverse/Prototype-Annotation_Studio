/**
 * Tab order (first occurrence of each path wins):
 * Home, Workspace, Project, User Management, Task, Annotator Task, Annotation Task,
 * Reviewer Task, Review Task, Export, Insight, Assignment, DB
 */
export const NAV_ITEMS = [
  { path: '/', label: 'Home', roles: ['super_admin', 'admin', 'ops_manager', 'annotator', 'reviewer', 'guest'] },
  { path: '/workspaces', label: 'Workspace', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/projects', label: 'Project', roles: ['super_admin', 'admin', 'ops_manager', 'guest'] },
  { path: '/users', label: 'User Management', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/tasks', label: 'Task', roles: ['super_admin', 'admin', 'ops_manager', 'guest'] },
  { path: '/tasks/annotator', label: 'Annotator Task', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/workqueue', label: 'Annotation Task', roles: ['annotator', 'super_admin', 'admin', 'ops_manager', 'reviewer'] },
  { path: '/tasks/reviewer', label: 'Reviewer Task', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/review', label: 'Review Task', roles: ['reviewer', 'super_admin', 'admin', 'ops_manager'] },
  { path: '/export', label: 'Export', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/insight', label: 'Insight', roles: ['super_admin', 'admin', 'ops_manager', 'reviewer', 'guest'] },
  { path: '/assignment', label: 'Assignment', roles: ['annotator', 'reviewer'] },
  { path: '/db', label: 'DB', roles: ['super_admin', 'admin', 'ops_manager'] },
  { path: '/requests', label: 'Requests', roles: ['super_admin', 'admin', 'ops_manager', 'annotator'] },
]

/** Get unique nav entries for role(s). First occurrence of each path wins. */
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
