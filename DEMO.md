# Annotation Studio V1 — Demo / Presentation

## One-login demo (Super Admin)

**Login:** `abhi@annotationstudio.com` / `admin123` (Super Admin)

Super Admin can act as **Annotator** and **Reviewer** in one session.

### 1. Annotator flow (image labelling)

1. Go to **Annotation Task** (or **Workqueue**).
2. Select **My tasks** tab.
3. Choose project **Animal Image Labels (Demo)** (or Kurukshetra Annotation Project).
4. Click **Start batch (image-by-image)** or **Get next task**.
5. **Label:** one image per screen; use checkbox + text; **Prev / Next**; wait 3s or **Skip**.
6. **Submit for review** when done (or **Exit batch**).

### 2. Reviewer flow

1. Same Workqueue page → switch to **Review queue** tab.
2. Optionally enable **Review as slides (FIFO)**.
3. See tasks in review: **Prev / Next**, **Approve** or **Send back for re-labelling** (rework count shown).

### 3. DB tab

- **DB** in nav (Super Admin / Admin / Ops Manager).
- Tables list loads; first table is auto-selected and data shown.
- Expand a table for schema and relationship diagram; change dropdown to view other tables.

### 4. Insight

- **Insight** → overview cards + **Annotator report by project**: select a project to see per-annotator stats (assigned, accepted, unlabeled, skipped, draft, word count, avg time).

---

## Reference projects (in Trio)

- **Shoonya:** `Trio/Shoonya` — [AI4Bharat/Shoonya](https://github.com/AI4Bharat/Shoonya) (annotation platform at scale).
- **Label Studio:** see project docs for path — multi-type labelling.

---

## Run locally

```batch
startserver.bat
```

- Backend: http://127.0.0.1:8000 (API docs: /docs)
- Frontend: http://localhost:5173
