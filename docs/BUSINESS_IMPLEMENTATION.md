# Annotation Studio V1 — Business Implementation

This document maps the **Initial Prompt** and PRD requirements to what is implemented in V1 and what is planned for later.

---

## Users & Roles

| Role | Implemented | Notes |
|------|------------|--------|
| **Super Admin** | Yes | abhi@annotationstudio.com / admin123; full access as Ops. |
| **Admin** | Yes | admin@annotationstudio.com / admin123; same as Ops for now. |
| **Operation Manager** | Yes | ops@annotationstudio.com; Assignment, Create, Task Create, Pipeline, Progress, Re-assign, Result/Export, Insight (placeholder). |
| **Annotator** | Yes | Sees assignments; pick from unassigned queue; Annotation Task; Submit for review; Save partial / Auto-save / Skip (partial in queue UI). |
| **Reviewer** | Yes | Review queue (FIFO); Approve / Reject (back to Annotator); Submit project to Ops (placeholder). |

---

## New Project Flow

| Step | Implemented | Notes |
|------|------------|--------|
| 1. Basic form | Yes | Workspace, Project name, ID, Description, Pipeline template. |
| 2. Data import | Planned | Bulk image/video/text/xml/json/audio/HTML + paste text → file; data insight after upload. |
| 3. Configure annotation attributes | Partial | Project has `response_schema`; UI for configuring attributes is planned. |
| 4. Assignment (Annotator, Reviewer) | Partial | Queue assign/claim; mass assignment UI planned. |
| 5. Send for annotation | Yes | Create project → add batches/tasks → annotators claim from queue. |

---

## Workqueue

| Queue | Implemented |
|-------|------------|
| Operation Manager | Placeholder (Analytics/Insight). |
| Primary Annotator | Yes — Get next task, My tasks, Annotate, Submit for review. |
| Reviewer | Yes — Review queue, Approve, Reject. |
| Secondary Annotator | Same as Primary (role can be extended). |

---

## Orchestration Flow

| Element | Implemented |
|---------|------------|
| Circular nodes | Yes — Flow canvas with nodes. |
| Solid filled circle (executed) | Yes — Status “completed” → green. |
| Empty double-line circle (skipped) | Yes — Status “skipped” → double border. |
| Start / End nodes | Yes — DB operations, config; Start/End types in specs. |
| Double donut (group / child project) | Yes — Node type “group”; can link child project. |
| Manual node (person icon) | Yes — Node type “manual”. |
| Color convention | Yes — Completed = green, In progress = silver, Pending = dark, Skipped = double outline. |
| Table per activity | Yes — ActivityInstance: instance_uid, project_id, spec_id, start_date, end_date, last_modified, status, owner, type, eta, max_eta. |
| API per node | Yes — POST trigger/complete/skip per instance_uid. |

---

## Tabs (Home)

| Item | Implemented |
|------|------------|
| Create Project | Yes |
| Invite member | Placeholder |
| Member performance | Placeholder |
| Recent projects with progress bar | Yes |
| Analytics | Placeholder |
| Organisation | Placeholder |
| API | Placeholder (OpenAPI at /docs) |
| DOC | Placeholder |
| Support | Placeholder |
| User profile | Placeholder |
| Search bar | Yes (header) |

---

## Database

- **SQLite** for prototype (no external DB install).
- **Tables:** users, workspaces, projects, activity_specs, activity_instances, batches, tasks, references, annotations.
- **IDs, dates, FKs** as per prompt; production can switch to PostgreSQL.

---

## Bat Files

- **firsttimesetup.bat** — Backend venv + pip install; frontend npm install.
- **startserver.bat** — Start backend (uvicorn) and frontend (npm run dev) in two windows.
- **create_desktop_shortcut.bat** — Desktop shortcut that runs startserver.bat.

---

## Documentation Delivered

- README — Run instructions, login.
- FILE_STRUCTURE.md — Project layout.
- BUSINESS_IMPLEMENTATION.md — This file.
- ARCHITECTURE.md — High-level architecture, node API, data model.
- ALL_PROMPTS.md — Copy of Initial Prompt (prioritised in case of conflict).

New Proposal PPT and Figma-like UI PPT can be created from this implementation and the PRD docs.
