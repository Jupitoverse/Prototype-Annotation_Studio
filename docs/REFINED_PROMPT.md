# Refined Prompt — Annotation Studio V1 (reuse anytime)

**Use this as the single prompt to restore or validate full product scope. Copy and paste when needed.**

---

## Refined prompt (full)

```
Annotation Studio V1 — Data labelling web app (FastAPI + React). Implement and maintain the following.

### Roles and access
- **Super Admin / Admin / Ops Manager:** Can do everything. See Annotator task tab, Reviewer task tab, collective tasks, DB tab, Requests, Insight, Export, User Management, Workspaces, Projects, Tasks.
- **Annotator:** Annotation tab (workqueue), Assignment, Request to claim others’ tasks, Request tab. See only assigned tasks by default; optionally see tasks assigned to others in same project/workspace.
- **Reviewer:** Review tab (workqueue), Assignment, Insight. One image per slide, progress bar, Next/Prev, Skip. Approve or Send back for re-labelling (same annotator redoes); store rework count; show annotator efficiency (e.g. 98% when 2 of 100 sent back).

### Ops/Admin — Collective tasks
- Single view of all annotator and reviewer tasks (collective).
- Filters: project, workspace, annotator, reviewer, dates (e.g. updated from/to), age, status, pipeline stage.
- Ops/Admin can claim any task (including reassigning from another user) to perform it themselves.

### Annotator — Annotation tab
- See tasks assigned to them by default. Option to show “tasks assigned to others” in the same project or workspace.
- One image per screen: Next/Prev, progress bar, one checkbox (from label config) + one text description, auto-save.
- Minimum 3 seconds per image (unless skipped). Skip allowed; skipped items listed at end with ability to un-skip and re-annotate.
- **Request to claim:** Annotator can request to take a task currently assigned to someone else. One approval from either the current assignee OR Ops/Admin fulfils the request (no need for both).

### Requests tab
- Visible to Annotator and Ops/Admin. Lists all claim requests (mine + where I am assignee + all for Ops).
- Filters: status (pending/approved/rejected), requested by, project.
- Color notation: e.g. pending = yellow, approved = green, rejected = red.
- For pending requests: assignee or Ops/Admin can Approve or Reject.

### Reviewer — Review tab
- One image per slide, progress bar, Next/Prev, Skip.
- Actions: Approve or Send back for re-labelling (sends back to same annotator).
- Show rework count when > 0 (e.g. “Sent back for re-labelling: N time(s)”).
- Store rework count per task; compute annotator efficiency (e.g. (total completed − sent back) / total = 98%).

### Dummy / demo data
- One dummy annotation project with dummy users and dummy animal images.
- Full workflow covered: L1, Review, Done; mix of statuses so Insight and multi-stage progress show data.
- Schema: one checkbox-like option + one text description (e.g. animal type + description).

### Bulk export
- Export option that preserves image reference (file/URL) and labels attached to each task (e.g. JSON with task_id, image_file, image_url, labels, status).

### DB tab
- Visible to Super Admin, Admin, Ops Manager only. No Internal Server Error; stable JSON response.
- List all DB tables. Expand/collapse per table to show schema (columns, types, nullable, PK) and a relationship diagram (how the table relates to others).
- Below: dropdown of all tables; on select, load that table’s data in the UI in a clear format (e.g. table with pagination).

### General
- Dark theme; professional UI; header/footer; simple login; roles: super_admin, admin, ops_manager, annotator, reviewer, guest.
- Maintain: README, file structure, business implementation doc, architecture, and this refined prompt.
```

---

## Quick checklist (from refined prompt)

| Area | Requirement |
|------|-------------|
| Ops/Admin | Annotator task tab, Reviewer task tab, collective tasks with filters (project, workspace, annotator, reviewer, dates, status), claim any task |
| Annotator | Assigned tasks by default; option to see others’ tasks; request to claim (one approval: assignee or Ops); 3s min per image; skip/unskip; auto-save |
| Reviewer | Slide view; progress bar; Next/Prev; Skip; Approve / Send back; rework count; efficiency % |
| Requests | Tab for all claim requests; filters; color notation; Approve/Reject by assignee or Ops |
| Dummy | One project, dummy users, animal images, full workflow, visible in Insight |
| Export | Bulk export preserving image + labels |
| DB tab | Super Admin + Admin + Ops; table list; expand for schema + diagram; dropdown to load table data; no 500 error |

---

*Last updated to match implementation. Reuse this prompt to onboard or validate scope.*
