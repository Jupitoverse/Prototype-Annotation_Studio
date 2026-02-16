# Annotation Studio V1

Enterprise **data labeling / annotation** web application with **enhanced orchestration flow** — a configurable alternative to Label Studio. Built with **FastAPI** and **React**, with a **dark theme and simulations** inspired by Orionverse (Orion-Agent): violet accent, animated gradient background, card hover lift, fade-in transitions, and loading spinners.

---

## Features

- **Orchestration flow:** Circular nodes (executed, skipped, start/end, group, manual); each node has an API; status colors (completed = green, in progress = silver, etc.).
- **Project hierarchy:** Workspace → Project (parent/child, profile types) → Batch → Task → Annotation.
- **Workqueue:** Operation Manager, Primary Annotator, Reviewer, Secondary Annotator; FIFO claim, submit for review, approve/reject.
- **New project wizard:** Basic form (workspace, name, description, pipeline template). **Project ID** is auto-generated (e.g. PRJ-00001) and saved in DB. Steps: Data import (drag-and-drop all media formats, per-file metrics), Configure attributes, Assign Annotator/Reviewer, Send for Annotation.
- **Microservice-ready:** No AI/LLM in this version; structure allows adding a separate service later.

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm

---

## First time setup

Run from project root:

```batch
firsttimesetup.bat
```

This will:

1. Create a Python venv in `backend` and install `requirements.txt`.
2. Run `npm install` in `frontend`.

---

## Start servers

**Option A — Batch file (two windows)**

```batch
startserver.bat
```

- Backend: http://127.0.0.1:8000 (API docs: http://127.0.0.1:8000/docs)
- Frontend: http://localhost:5173

**Option B — Manual**

```batch
# Terminal 1 — Backend
cd backend
venv\Scripts\activate   # or: call venv\Scripts\activate.bat
uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

---

## Desktop shortcut

Run once to create a desktop shortcut that starts both servers:

```batch
create_desktop_shortcut.bat
```

---

## Login (dummy users — Mahabharat-inspired)

| Role        | Email                         | Password   |
|------------|--------------------------------|------------|
| **Super Admin** | abhi@annotationstudio.com, krishna@annotationstudio.com | admin123 / mahabharat |
| **Admin**  | yudhishthira@annotationstudio.com | mahabharat |
| **Ops Manager** | bhima@annotationstudio.com | mahabharat |
| **Annotator** | arjuna@annotationstudio.com, sahadev@annotationstudio.com | mahabharat |
| **Reviewer** | nakula@annotationstudio.com, draupadi@annotationstudio.com | mahabharat |
| **Guest** | guest@annotationstudio.com | guest |

Legacy: admin@annotationstudio.com / admin123, ops@annotationstudio.com / demo, annotator@annotationstudio.com / demo, reviewer@annotationstudio.com / demo.

**Dummy data:** Seed creates workspace "Kurukshetra", project **PRJ-00001** (Kurukshetra Annotation Project) with batches and tasks, plus default workflow. Use it to try Workqueue and Flow.

---

## Documentation

- **File structure:** [docs/FILE_STRUCTURE.md](docs/FILE_STRUCTURE.md)
- **Business implementation:** [docs/BUSINESS_IMPLEMENTATION.md](docs/BUSINESS_IMPLEMENTATION.md)
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **All prompts (prioritised):** [docs/ALL_PROMPTS.md](docs/ALL_PROMPTS.md)
- **Refined prompt (reuse anytime):** [docs/REFINED_PROMPT.md](docs/REFINED_PROMPT.md) — single consolidated prompt for full scope (image labelling, Ops/Admin tasks, Annotator request-to-claim, Reviewer rework, DB tab, export, dummy data).

New Proposal PPT and Architecture/UI PPT can be derived from this implementation and the PRD docs under `Data Annotation\PRD Docs`.

---

## Project location

Created under: `C:\Users\abhisha3\Desktop\Projects\Perosnal\Data Annotation\Annotation Studio V1`
