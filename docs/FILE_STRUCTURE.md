# Annotation Studio V1 — File Structure

```
Annotation Studio V1/
├── backend/                    # FastAPI backend (microservice-ready)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app, lifespan, seed, CORS, static serve
│   │   ├── config.py           # Settings (database_url, JWT, upload_dir)
│   │   ├── database.py         # SQLAlchemy engine, SessionLocal, Base
│   │   ├── models.py           # User, Workspace, Project, ActivitySpec, ActivityInstance, Batch, Task, Reference, Annotation
│   │   ├── schemas.py          # Pydantic request/response
│   │   ├── auth.py             # JWT, bcrypt, get_current_user, require_ops / require_annotator / require_reviewer
│   │   └── routers/
│   │       ├── auth_router.py
│   │       ├── workspaces_router.py
│   │       ├── projects_router.py
│   │       ├── activity_router.py   # Activity specs, instances, node trigger/complete/skip API
│   │       ├── batches_router.py
│   │       ├── tasks_router.py
│   │       └── queue_router.py      # get next, my-tasks, submit, review approve/reject
│   ├── requirements.txt
│   └── uploads/                # (created at runtime) file uploads
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx              # Routes, auth state, Layout
│   │   ├── api.js               # api(), getToken, setToken, logout
│   │   ├── index.css            # Dark theme, orchestration node styles
│   │   └── components/
│   │       ├── Login.jsx
│   │       ├── Layout.jsx       # Header, sidebar, footer
│   │       ├── Home.jsx         # Dashboard: Create Project, Recent projects
│   │       ├── Projects.jsx     # Project list, workspace filter
│   │       ├── NewProject.jsx   # New project wizard (Basic step)
│   │       ├── ProjectDetail.jsx
│   │       ├── FlowCanvas.jsx   # Orchestration flow (circular nodes)
│   │       ├── Workqueue.jsx     # Annotator / Reviewer queue
│   │       └── Placeholder.jsx  # Analytics, Organisation, API, DOC, Support, Profile
│   ├── index.html
│   ├── package.json
│   └── vite.config.js           # Proxy to backend
├── docs/
│   ├── FILE_STRUCTURE.md       # This file
│   ├── BUSINESS_IMPLEMENTATION.md
│   ├── ARCHITECTURE.md
│   └── ALL_PROMPTS.md          # Copy of Initial Prompt
├── Initial Prompt.txt          # Source prompt (prioritised in case of conflict)
├── firsttimesetup.bat          # Install backend + frontend deps
├── startserver.bat             # Start backend + frontend (two windows)
├── create_desktop_shortcut.bat # Create desktop icon to launch servers
└── README.md
```

## Backend (microservice approach)

- **Config:** Environment or defaults; `database_url` can be switched to PostgreSQL for production.
- **Models:** Hierarchical (Workspace → Project → Batch → Task → Annotation); orchestration (ActivitySpec + ActivityInstance per project); Reference table for static data.
- **Routers:** REST-style; each activity node has API (trigger, complete, skip) for orchestration flow.
- **No AI/LLM** in this version; structure allows adding a separate service later.

## Frontend

- **Dark theme** (Netflix/n8n style); CSS variables in `index.css`.
- **Header:** Logo, search bar, user email, role badge, Log out.
- **Sidebar:** Home, Create Project, Projects, Workqueue, Analytics, Organisation, API, DOC, Support, Profile.
- **Footer:** One-line app description.
