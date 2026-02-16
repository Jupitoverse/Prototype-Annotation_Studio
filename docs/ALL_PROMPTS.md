# All Prompts — Annotation Studio V1

**Prioritised in case of conflict:** Initial Prompt (below) takes precedence.

**Reuse anytime:** See **`docs/REFINED_PROMPT.md`** for the single refined prompt that captures all requirements (image labelling use case, Ops/Admin collective tasks, Annotator request-to-claim, Reviewer slide view and rework, DB tab, dummy data, bulk export). Copy from there to restore or validate full scope.

---

## Source

- **File:** `Initial Prompt.txt` (project root)
- **References:** PRD Docs at `C:\Users\abhisha3\Desktop\Projects\Perosnal\Data Annotation\PRD Docs`  
  - Data_Annotation_Platform_PRD_Addendum_v2.0 - Copy.pdf  
  - Reference images: Project flow.png, hierarchy like this.png, child flow..., etc.
- **Label Studio reference:** `C:\Users\abhisha3\Desktop\Projects\Perosnal\Label Studio`

---

## Initial Prompt (full text)

```
Hi I have to create a Data Labelling or Annotation web application which will be for enterprise and would be scalable using fast api and react and other related techstack.

Refer; C:\Users\abhisha3\Desktop\Projects\Perosnal\Data Annotation\PRD Docs
Complete code of Label Studio; C:\Users\abhisha3\Desktop\Projects\Perosnal\Label Studio
PRD Document by the client; ...\PRD Docs\Data_Annotation_Platform_PRD_Addendum_v2.0 - Copy.pdf
Rough Proposal created by Us;
And Below detailed prompt created by me manually which should be prioritised in case of conflict.
Open Questions; ...\PRD Docs\Questions.docx
Previous chat context

File Structure:
Follow microservice approach so that we can easily scale and add AI or LLM thing later.
Current version dont need any implementation of AI,LLM,RAG etc
Maintain below .md file or ppt ;
	Readme
	All prompt
	file structure description
	business implimentation
	New Proposal ppt
	Architecture based on prd and current project implementation
	one ppt showing figma like ui that we are going to build here.
Make required bat file now like;
	firsttimesetup
	startserver including backend and frontend
	create desktop icon which will launch project with all server running

Application;
	should follow dark theme like netflix or n8n website
	should be having nice professional simulation effect wherever applicable.
	proper header and footer like application not website
	keep simple login approach now or implement full fledge login method using company id and create few login for admin and super admin with name abhi and share with me to login.

New Project: New Annotator Profile Create, New Reviewer profile Creation
Workqueue: Operation manager, Primary Annotator, Reviewer, Secondary Annotator

> Basic Form: Workspace, Project Name: ID : Description : Pipeline Template
> Data Import: Drag and Upload: Bulk Image, Video, Text, XML, JSON, Audio, HTML; paste text → text file; Data Insight once upload completed
> Configure Annotation attributes for input
> Assignment > Annotator, Reviewer
> Send for Annotation

User:
1. Super Admin — All as Operation manager for now
2. Admin — All as Operation manager for now
3. Operation manager: Assignment, Create, Assignment Configure (Date for Annotation, Review), Task Create, pipeline, progress, Re-assign, Request Clarification/Re-Assignment, Result (bulk Export), Insight
4. Annotator: Profile, Assignments, pick from unassigned Queue, Annotation Task, Previous Work (Feedback, Insight, Rework), Response from Reviewer/QA, Submit for Review, Save partial, Auto Save 1 min, Skip for later, Skip for Clarification, Request Re-assign (Ops approval)
5. Reviewer: Review by filter (default FIFO), Approve, Reject (back to Annotator/Secondary), Skip for later, Submit Project for Operation manager, Insight, Profile, Assignment

Tab / Home: Create Project, Auto label with prompt, Invite member, Member performance, Recent Project with Progress bar, Analytics, Organisation, API, DOC, Support, User Profile, Search Bar

Orchestration flow (circular nodes):
- Normal solid filled circle = Activity executed
- Empty double line circle = Activity skipped
- Start / End node = DB operations, notification, queue movement, email
- Double Donut = Group of nodes or child project linked to parent
- Node with person = Manual activity (e.g. annotator submits → completed)
- Color convention: completed = light green, progress = silver, etc.
- Table per activity: unique spec id, random unique id per project instance, start date, end date, last modified, status, owner, type, eta, max eta
- Multiple postgres tables (prototype: SQLite), proper id, dates, joins, FKs
- Every node has API: accept request from previous or admin, do operation, update DB, send to next node

Tables: Project, activity, task, Reference (static data: unique id, name, api endpoint, description); projects can have multiple profile (parent, annotator, review, reassignment).

Create project under: C:\Users\abhisha3\Desktop\Projects\Perosnal\Data Annotation\Annotation Studio V1
```

(Above is a condensed summary; full wording is in `Initial Prompt.txt`.)
