import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { Login } from './components/Login'
import { Layout } from './components/Layout'
import { Home } from './components/Home'
import { Projects } from './components/Projects'
import { NewProject } from './components/NewProject'
import { ProjectDetail } from './components/ProjectDetail'
import { FlowCanvas } from './components/FlowCanvas'
import { Workqueue } from './components/Workqueue'
import { TaskList } from './components/TaskList'
import { TasksByRole } from './components/TasksByRole'
import { Insight } from './components/Insight'
import { Export } from './components/Export'
import { Placeholder } from './components/Placeholder'
import { UserManagement } from './components/UserManagement'
import { Workspaces } from './components/Workspaces'
import { Assignment } from './components/Assignment'
import { DB } from './components/DB'
import { Requests } from './components/Requests'
import { api, setToken, getToken, logout as apiLogout } from './api'

function App() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  const loadUser = useCallback(async () => {
    const t = getToken()
    if (!t) return setUser(null)
    try {
      const u = await api('/auth/me')
      setUser(u)
    } catch {
      apiLogout()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const onLogin = (token, u) => {
    setToken(token)
    setUser(u)
    navigate('/')
  }

  const logout = () => {
    apiLogout()
    setUser(null)
    navigate('/')
  }

  if (!user) {
    return <Login onLogin={onLogin} />
  }

  const canOps = ['super_admin', 'admin', 'ops_manager'].includes(user.role)
  const canAnnotator = ['annotator', 'ops_manager', 'admin', 'super_admin'].includes(user.role)
  const canReviewer = ['reviewer', 'ops_manager', 'admin', 'super_admin'].includes(user.role)

  return (
    <Layout user={user} logout={logout}>
      <Routes>
        <Route path="/" element={<Home user={user} canOps={canOps} />} />
        <Route path="/users" element={canOps ? <UserManagement /> : <Placeholder title="Access restricted" description="User Management is only available to Super Admin, Admin, and Operation Manager." />} />
        <Route path="/workspaces" element={canOps ? <Workspaces /> : <Placeholder title="Access restricted" description="Workspaces tab is for Ops / Admin." />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={canOps ? <NewProject /> : <Placeholder title="Access restricted" description="Only Super Admin, Admin, or Operation Manager can create projects." />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:id/flow" element={<FlowCanvas />} />
        <Route path="/workqueue" element={<Workqueue user={user} canAnnotator={canAnnotator} canReviewer={canReviewer} />} />
        <Route path="/review" element={<Workqueue user={user} canAnnotator={canAnnotator} canReviewer={canReviewer} initialView="reviewer" />} />
        <Route path="/tasks" element={<TaskList />} />
        <Route path="/tasks/annotator" element={<TasksByRole role="annotator" title="Tasks by Annotator" emptyMessage="No tasks assigned to annotators yet. Assign tasks from a project." />} />
        <Route path="/tasks/reviewer" element={<TasksByRole role="reviewer" title="Tasks by Reviewer" emptyMessage="No tasks assigned to reviewers yet. Assign reviewers from a project." />} />
        <Route path="/tasks/new" element={<Placeholder title="Task Create" description="Create new tasks (batch or single). Available to Ops / Admin." />} />
        <Route path="/assignment" element={<Assignment />} />
        <Route path="/assignment/configure" element={<Placeholder title="Assignment Configure" description="Date for Annotation, Review — set deadlines and review windows." />} />
        <Route path="/progress" element={<Placeholder title="Progress" description="Project and task progress overview." />} />
        <Route path="/reassign" element={<Placeholder title="Re-assign" description="Re-assign tasks to annotators or reviewers." />} />
        <Route path="/requests/clarification" element={<Placeholder title="Request Raised for Clarification" description="Requests from annotators for clarification (Ops/Admin)." />} />
        <Route path="/requests/reassign" element={<Placeholder title="Request Raised for Re-Assignment" description="Requests for re-assignment; Operation Manager approval." />} />
        <Route path="/export" element={canOps ? <Export /> : <Placeholder title="Access restricted" description="Export is available to Super Admin, Admin, and Operation Manager." />} />
        <Route path="/insight" element={<Insight />} />
        <Route path="/db" element={canOps ? <DB /> : <Placeholder title="Access restricted" description="DB tab is for Super Admin, Admin, or Ops Manager." />} />
        <Route path="/requests" element={<Requests user={user} canOps={canOps} canAnnotator={canAnnotator} />} />
      </Routes>
    </Layout>
  )
}

export default App
