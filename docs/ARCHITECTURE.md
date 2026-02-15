# Annotation Studio V1 — Architecture

High-level architecture based on PRD and current implementation. Use for New Proposal and handoff.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser — React (Vite) SPA                                          │
│  Dark theme · Header / Sidebar / Footer · Home, Projects, Flow, Queue │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP / JSON (JWT)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Backend — FastAPI                                                    │
│  Auth (JWT) · Workspaces · Projects · Activities (specs + instances)   │
│  Batches · Tasks · Queue (claim, submit, review) · Node API           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SQLAlchemy ORM
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Database — SQLite (prototype) → PostgreSQL (production)              │
│  users, workspaces, projects, activity_specs, activity_instances,    │
│  batches, tasks, references, annotations                             │
└─────────────────────────────────────────────────────────────────────┘
```

- **Microservice-ready:** Backend and frontend are separate; AI/LLM can be added as another service later.
- **No AI/LLM** in current version.

---

## 2. Orchestration Flow (Enhanced)

- **ActivitySpec** — Reference table: unique `spec_id`, name, api_endpoint, description, `node_type` (start | end | normal | skipped | group | manual).
- **ActivityInstance** — One row per node per project run: `instance_uid`, `project_id`, `spec_id`, `start_date`, `end_date`, `last_modified`, `status`, `owner_id`, `node_type`, `eta_minutes`, `max_eta_minutes`, `payload`, `next_instance_ids` (edges).
- **Node API:** Each node has an API that accepts a request (from previous node or admin), performs DB updates (and optional notifications/queue movement), and can trigger the next node(s).
  - `POST /activities/nodes/{instance_uid}/trigger` — Start / progress.
  - `POST /activities/nodes/{instance_uid}/complete` — Mark completed.
  - `POST /activities/nodes/{instance_uid}/skip` — Mark skipped.
- **Visual:** Circular nodes; solid = executed (green), double outline = skipped, Start/End = accent, Group = double donut, Manual = person icon.

---

## 3. Data Model (Summary)

- **User** — email, role (super_admin, admin, ops_manager, annotator, reviewer), company_id.
- **Workspace** → **Project** (parent_id, profile_type: parent | annotator | review | reassignment) → **Batch** → **Task**.
- **ActivitySpec** (reference) ← **ActivityInstance** (per project).
- **Task** → **Annotation** (response JSON, pipeline_stage).
- **Reference** — Static data (ref_type, unique_id, name, api_endpoint, description).

---

## 4. Auth & Roles

- Login: email + password; JWT in `Authorization: Bearer <token>`.
- Roles: super_admin, admin, ops_manager, annotator, reviewer.
- Guards: require_ops, require_annotator, require_reviewer, require_admin.

---

## 5. Deployment

- **Dev:** Run backend (uvicorn from `backend/`), frontend (npm run dev from `frontend/`); Vite proxy to backend.
- **Production:** Build frontend (`npm run build`), serve from FastAPI (mount `frontend/dist`); or separate static host.
- **DB:** Replace SQLite with PostgreSQL via `database_url`; same schema (or add migrations e.g. Alembic).

This architecture aligns with the PRD and the Initial Prompt’s orchestration and table design.
