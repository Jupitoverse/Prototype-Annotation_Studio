from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import text

from .database import engine, Base, SessionLocal
from .models import User, Workspace, Project, Media, UserTagged, ActivitySpec, ActivityInstance, Batch, Task, TaskClaimRequest
from .auth import get_password_hash
from .routers import auth_router, users_router, workspaces_router, projects_router, activity_router, batches_router, tasks_router, queue_router, insight_router, db_router, requests_router


def _migrate_users_table():
    """Add new User columns if they don't exist (for existing DBs)."""
    with engine.connect() as conn:
        for sql in [
            "ALTER TABLE users ADD COLUMN external_id VARCHAR(50)",
            "ALTER TABLE users ADD COLUMN workspace_id INTEGER",
            "ALTER TABLE users ADD COLUMN first_name VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN middle_name VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN last_name VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN workspace_ids VARCHAR(500)",
            "ALTER TABLE users ADD COLUMN mobile VARCHAR(50)",
            "ALTER TABLE users ADD COLUMN userid VARCHAR(50)",
            "ALTER TABLE users ADD COLUMN availability VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN max_load INTEGER",
            "ALTER TABLE workspaces ADD COLUMN created_by_id INTEGER",
            "ALTER TABLE workspaces ADD COLUMN total_projects INTEGER",
            "ALTER TABLE workspaces ADD COLUMN status VARCHAR(50)",
            "ALTER TABLE workspaces ADD COLUMN close_date VARCHAR(50)",
            "ALTER TABLE workspaces ADD COLUMN project_data VARCHAR(1000)",
            "ALTER TABLE projects ADD COLUMN num_annotators INTEGER",
            "ALTER TABLE projects ADD COLUMN num_reviewers INTEGER",
            "ALTER TABLE projects ADD COLUMN close_by_id INTEGER",
            "ALTER TABLE projects ADD COLUMN annotator_ids VARCHAR(500)",
            "ALTER TABLE projects ADD COLUMN reviewer_ids VARCHAR(500)",
            "ALTER TABLE projects ADD COLUMN annotator_pct VARCHAR(500)",
            "ALTER TABLE projects ADD COLUMN reviewer_pct VARCHAR(500)",
            "ALTER TABLE projects ADD COLUMN annotator_eta_days VARCHAR(500)",
            "ALTER TABLE projects ADD COLUMN reviewer_eta_days VARCHAR(500)",
            "ALTER TABLE tasks ADD COLUMN due_at VARCHAR(50)",
            "ALTER TABLE tasks ADD COLUMN rework_count INTEGER",
            "ALTER TABLE tasks ADD COLUMN draft_response VARCHAR(2000)",
        ]:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()
                pass
    # Create task_claim_requests if missing
    if "task_claim_requests" not in [t.name for t in Base.metadata.sorted_tables]:
        Base.metadata.create_all(bind=engine, tables=[TaskClaimRequest.__table__])


def _ensure_user(db, email, password, full_name, role, availability="100%", max_load=50):
    u = db.query(User).filter(User.email == email).first()
    if not u:
        u = User(
            email=email,
            hashed_password=get_password_hash(password),
            first_name=full_name or "",
            last_name="",
            full_name=full_name or "",
            role=role,
            availability=availability,
            max_load=max_load,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
    else:
        u.hashed_password = get_password_hash(password)
        u.role = role
        if not getattr(u, "first_name", None) and full_name:
            u.first_name = full_name
            u.full_name = full_name
        db.commit()
    return u


def _assign_userids(db):
    """Assign userid u1, u2, u3... to any user missing one."""
    users = db.query(User).order_by(User.id).all()
    for i, u in enumerate(users, 1):
        uid = f"u{i}"
        if getattr(u, "userid", None) != uid:
            u.userid = uid
            u.external_id = uid
        if getattr(u, "availability", None) is None:
            u.availability = "100%"
        if getattr(u, "max_load", None) is None:
            u.max_load = 50
    db.commit()


def seed_db():
    db = SessionLocal()
    try:
        # Activity specs (reference): start, end, normal, skipped, group, manual
        if db.query(ActivitySpec).count() == 0:
            for spec in [
                ActivitySpec(spec_id="start", name="Start", description="Project start", api_endpoint="/api/activities/nodes/start", node_type="start"),
                ActivitySpec(spec_id="end", name="End", description="Project end", api_endpoint="/api/activities/nodes/end", node_type="end"),
                ActivitySpec(spec_id="normal", name="Activity", description="Normal activity", api_endpoint="/api/activities/nodes/trigger", node_type="normal"),
                ActivitySpec(spec_id="skipped", name="Skipped", description="Skipped activity", api_endpoint="/api/activities/nodes/skip", node_type="skipped"),
                ActivitySpec(spec_id="group", name="Group / Child", description="Group or child project", api_endpoint="/api/activities/nodes/group", node_type="group"),
                ActivitySpec(spec_id="manual", name="Manual Task", description="Requires manual input", api_endpoint="/api/activities/nodes/manual", node_type="manual"),
            ]:
                db.add(spec)
            db.commit()

        # ----- At least 20 dummy users across all roles (User Management + dropdowns + filters) -----
        # Super Admin (2)
        abhi = _ensure_user(db, "abhi@annotationstudio.com", "admin123", "Abhi", "super_admin")
        _ensure_user(db, "admin@annotationstudio.com", "admin123", "Admin", "super_admin")
        # Admin (2)
        _ensure_user(db, "yudhishthira@annotationstudio.com", "admin123", "Yudhishthira", "admin")
        _ensure_user(db, "admin2@annotationstudio.com", "admin123", "Admin Two", "admin")
        # Ops Manager (2)
        bhima = _ensure_user(db, "bhima@annotationstudio.com", "admin123", "Bhima", "ops_manager")
        _ensure_user(db, "ops@annotationstudio.com", "admin123", "Ops Manager", "ops_manager")
        # Annotator (5)
        _ensure_user(db, "annotator1@annotationstudio.com", "demo123", "Annotator One", "annotator")
        _ensure_user(db, "annotator2@annotationstudio.com", "demo123", "Annotator Two", "annotator")
        _ensure_user(db, "annotator3@annotationstudio.com", "demo123", "Annotator Three", "annotator")
        _ensure_user(db, "annotator4@annotationstudio.com", "demo123", "Annotator Four", "annotator")
        _ensure_user(db, "annotator5@annotationstudio.com", "demo123", "Annotator Five", "annotator")
        # Reviewer (5)
        _ensure_user(db, "reviewer1@annotationstudio.com", "demo123", "Reviewer One", "reviewer")
        _ensure_user(db, "reviewer2@annotationstudio.com", "demo123", "Reviewer Two", "reviewer")
        _ensure_user(db, "reviewer3@annotationstudio.com", "demo123", "Reviewer Three", "reviewer")
        _ensure_user(db, "reviewer4@annotationstudio.com", "demo123", "Reviewer Four", "reviewer")
        _ensure_user(db, "reviewer5@annotationstudio.com", "demo123", "Reviewer Five", "reviewer")
        # Guest (2)
        _ensure_user(db, "guest@annotationstudio.com", "guest123", "Guest User", "guest")
        _ensure_user(db, "guest2@annotationstudio.com", "guest123", "Guest Two", "guest")
        # Support Person (2)
        _ensure_user(db, "support1@annotationstudio.com", "support123", "Support One", "support_person")
        _ensure_user(db, "support2@annotationstudio.com", "support123", "Support Two", "support_person")

        # Workspaces: create first so we can assign workspace_ids to users with created_by, total_projects, project_data
        ops_user = db.query(User).filter(User.role == "ops_manager").first() or db.query(User).filter(User.role == "admin").first()
        created_by_id = ops_user.id if ops_user else None
        ws_mumbai = db.query(Workspace).filter(Workspace.name == "Mumbai Workspace").first()
        if not ws_mumbai:
            ws_mumbai = Workspace(
                name="Mumbai Workspace",
                description="West region – data isolated under this workspace",
                created_by_id=created_by_id,
                total_projects=0,
                status="active",
                project_data=[],
            )
            db.add(ws_mumbai)
            db.commit()
            db.refresh(ws_mumbai)
        ws_delhi = db.query(Workspace).filter(Workspace.name == "Delhi NCR Workspace").first()
        if not ws_delhi:
            ws_delhi = Workspace(
                name="Delhi NCR Workspace",
                description="North region – data isolated under this workspace",
                created_by_id=created_by_id,
                total_projects=0,
                status="active",
                project_data=[],
            )
            db.add(ws_delhi)
            db.commit()
            db.refresh(ws_delhi)

        # Legacy workspaces (Default, Kurukshetra) for backward compat
        ws_default = db.query(Workspace).filter(Workspace.name == "Default Workspace").first()
        if not ws_default:
            ws_default = Workspace(name="Default Workspace", description="Annotation Studio Demo", created_by_id=created_by_id, total_projects=0, status="active", project_data=[])
            db.add(ws_default)
            db.commit()
            db.refresh(ws_default)
        ws_kuru = db.query(Workspace).filter(Workspace.name == "Kurukshetra").first()
        if not ws_kuru:
            ws_kuru = Workspace(name="Kurukshetra", description="Mahabharat dummy project workspace", created_by_id=created_by_id, total_projects=0, status="active", project_data=[])
            db.add(ws_kuru)
            db.commit()
            db.refresh(ws_kuru)

        # Assign userids (u1, u2, ...) to all users
        _assign_userids(db)
        # Give annotators and reviewers access to Mumbai and Delhi workspaces
        for u in db.query(User).filter(User.role.in_(["annotator", "reviewer", "ops_manager", "admin", "super_admin"])).all():
            if not getattr(u, "workspace_ids", None) or u.workspace_ids == []:
                u.workspace_ids = [ws_mumbai.id, ws_delhi.id]
        db.commit()

        # Animals Demo workspace and Animals Prototype project (10 animal images for annotation demo)
        from datetime import datetime as _dt
        _now = _dt.utcnow()
        _annotators = db.query(User).filter(User.role == "annotator").order_by(User.id).all()
        _reviewers = db.query(User).filter(User.role == "reviewer").order_by(User.id).all()
        ws_animals = db.query(Workspace).filter(Workspace.name == "Animals Demo").first()
        if not ws_animals:
            ws_animals = Workspace(
                name="Animals Demo",
                description="Demo workspace for animal image annotation and review workflow",
                created_by_id=created_by_id,
                total_projects=0,
                status="active",
                project_data=[],
            )
            db.add(ws_animals)
            db.commit()
            db.refresh(ws_animals)
        proj_animals_proto = db.query(Project).filter(Project.external_id == "PRJ-ANIMALS-PROTO").first()
        if not proj_animals_proto:
            ann = _annotators[:2] if _annotators else []
            rev = _reviewers[:1] if _reviewers else []
            proj_animals_proto = Project(
                workspace_id=ws_animals.id,
                external_id="PRJ-ANIMALS-PROTO",
                name="Animals Prototype",
                description="Animal image annotation: label animal name and what the animal is doing. For annotator and reviewer workflow demo.",
                profile_type="parent",
                pipeline_stages=["L1", "Review", "Done"],
                response_schema={
                    "animal_name": "free_text",
                    "what_animal_is_doing": "free_text",
                },
                status="active",
                created_by_id=created_by_id or abhi.id,
                num_annotators=len(ann),
                num_reviewers=len(rev),
                annotator_ids=[u.id for u in ann],
                reviewer_ids=[u.id for u in rev],
            )
            db.add(proj_animals_proto)
            db.commit()
            db.refresh(proj_animals_proto)
            for u in ann:
                db.add(UserTagged(user_id=u.id, user_role=u.role, workspace_id=ws_animals.id, project_id=proj_animals_proto.id, startdate=_now, tagged_date=_now))
            for u in rev:
                db.add(UserTagged(user_id=u.id, user_role=u.role, workspace_id=ws_animals.id, project_id=proj_animals_proto.id, startdate=_now, tagged_date=_now))
            batch_ap = Batch(project_id=proj_animals_proto.id, name="Animal images batch")
            db.add(batch_ap)
            db.commit()
            db.refresh(batch_ap)
            # 10 animal images from the web (picsum with seeds for variety; filenames match for export reference)
            animal_contents = [
                {"file": "animal_01.jpg", "url": "https://picsum.photos/seed/lion/600/400"},
                {"file": "animal_02.jpg", "url": "https://picsum.photos/seed/elephant/600/400"},
                {"file": "animal_03.jpg", "url": "https://picsum.photos/seed/tiger/600/400"},
                {"file": "animal_04.jpg", "url": "https://picsum.photos/seed/dog/600/400"},
                {"file": "animal_05.jpg", "url": "https://picsum.photos/seed/cat/600/400"},
                {"file": "animal_06.jpg", "url": "https://picsum.photos/seed/bird/600/400"},
                {"file": "animal_07.jpg", "url": "https://picsum.photos/seed/bear/600/400"},
                {"file": "animal_08.jpg", "url": "https://picsum.photos/seed/deer/600/400"},
                {"file": "animal_09.jpg", "url": "https://picsum.photos/seed/fox/600/400"},
                {"file": "animal_10.jpg", "url": "https://picsum.photos/seed/wolf/600/400"},
            ]
            for c in animal_contents:
                db.add(Task(batch_id=batch_ap.id, content=c, status="pending", pipeline_stage="L1"))
            db.commit()
            # Give super admin annotator/reviewer access to Animals Prototype for one-login demo
            if abhi:
                aid = abhi.id
                annotator_ids = list(getattr(proj_animals_proto, "annotator_ids", None) or [])
                reviewer_ids = list(getattr(proj_animals_proto, "reviewer_ids", None) or [])
                if aid not in annotator_ids:
                    annotator_ids.append(aid)
                    proj_animals_proto.annotator_ids = annotator_ids
                if aid not in reviewer_ids:
                    reviewer_ids.append(aid)
                    proj_animals_proto.reviewer_ids = reviewer_ids
                proj_animals_proto.num_annotators = len(annotator_ids)
                proj_animals_proto.num_reviewers = len(reviewer_ids)
                if db.query(UserTagged).filter(UserTagged.user_id == aid, UserTagged.project_id == proj_animals_proto.id, UserTagged.user_role == "annotator").first() is None:
                    db.add(UserTagged(user_id=aid, user_role="annotator", workspace_id=ws_animals.id, project_id=proj_animals_proto.id, startdate=_now, tagged_date=_now))
                if db.query(UserTagged).filter(UserTagged.user_id == aid, UserTagged.project_id == proj_animals_proto.id, UserTagged.user_role == "reviewer").first() is None:
                    db.add(UserTagged(user_id=aid, user_role="reviewer", workspace_id=ws_animals.id, project_id=proj_animals_proto.id, startdate=_now, tagged_date=_now))
            db.commit()

        # Dummy project: Kurukshetra Annotation (PRJ-00001) with tasks and workflow
        proj_kuru = db.query(Project).filter(Project.external_id == "PRJ-00001").first()
        if not proj_kuru:
            proj_kuru = Project(
                workspace_id=ws_kuru.id,
                external_id="PRJ-00001",
                name="Kurukshetra Annotation Project",
                description="Dummy project with Mahabharat-inspired tasks and insight",
                profile_type="parent",
                pipeline_template="default",
                pipeline_stages=["L1", "Review", "Done"],
                response_schema={"sentiment": "single_select", "notes": "free_text", "entity": "free_text"},
                status="active",
                created_by_id=abhi.id,
            )
            db.add(proj_kuru)
            db.commit()
            db.refresh(proj_kuru)
            batch1 = Batch(project_id=proj_kuru.id, name="Pandava Batch 1")
            db.add(batch1)
            db.commit()
            db.refresh(batch1)
            dummy_texts = [
                "The righteous path is often difficult.",
                "Strength and strategy must go hand in hand.",
                "Unity of purpose leads to victory.",
                "Wisdom guides action.",
                "Dharma protects those who uphold it.",
            ]
            for i, text in enumerate(dummy_texts, 1):
                db.add(Task(batch_id=batch1.id, content={"text": text, "ref": f"KURU-{i}"}))
            batch2 = Batch(project_id=proj_kuru.id, name="Insight Batch 2")
            db.add(batch2)
            db.commit()
            db.refresh(batch2)
            for i in range(1, 4):
                db.add(Task(batch_id=batch2.id, content={"text": f"Insight task {i}: Label sentiment and entities."}))
            db.commit()
            # Default workflow for this project
            specs = {s.spec_id: s for s in db.query(ActivitySpec).all()}
            labels = [("start", "Start"), ("normal", "Configure"), ("normal", "Assign"), ("manual", "Annotate"), ("normal", "Review"), ("end", "End")]
            created_uids = []
            for spec_id_key, name in labels:
                spec = specs.get(spec_id_key) or specs.get("normal")
                inst = ActivityInstance(
                    project_id=proj_kuru.id,
                    spec_id=spec.id,
                    node_type=spec.node_type,
                    status="completed" if name == "Start" else "pending",
                    payload={"label": name},
                )
                db.add(inst)
                db.flush()
                created_uids.append(inst.instance_uid)
            for i in range(len(created_uids) - 1):
                inst = db.query(ActivityInstance).filter(
                    ActivityInstance.project_id == proj_kuru.id,
                    ActivityInstance.instance_uid == created_uids[i],
                ).first()
                if inst:
                    inst.next_instance_ids = [created_uids[i + 1]]
            db.commit()

        # Mumbai workspace: 3 projects with Indian-name annotators/reviewers
        annotators = db.query(User).filter(User.role == "annotator").order_by(User.id).all()
        reviewers = db.query(User).filter(User.role == "reviewer").order_by(User.id).all()
        from datetime import datetime as dt
        now = dt.utcnow()
        for ws, proj_names in [
            (ws_mumbai, ["Mumbai Sentiment Labels", "Mumbai Entity Recognition", "Mumbai Quality Check"]),
            (ws_delhi, ["Delhi NCR Text Classification", "Delhi Image Tags", "Delhi Audio Transcription", "Delhi Review Pipeline"]),
        ]:
            prefix = "PRJ-MUM" if "Mumbai" in ws.name else "PRJ-DLH"
            for idx, pname in enumerate(proj_names, 1):
                ext_id = f"{prefix}-{idx:02d}"
                if db.query(Project).filter(Project.external_id == ext_id).first():
                    continue
                proj = Project(
                    workspace_id=ws.id,
                    external_id=ext_id,
                    name=pname,
                    description=f"Dummy project under {ws.name}",
                    profile_type="parent",
                    pipeline_stages=["L1", "Review", "Done"],
                    response_schema={"label": "single_select", "notes": "free_text"},
                    status="active",
                    created_by_id=created_by_id,
                    num_annotators=min(2, len(annotators)),
                    num_reviewers=min(1, len(reviewers)),
                    annotator_ids=[u.id for u in annotators[:2]],
                    reviewer_ids=[u.id for u in reviewers[:1]],
                )
                db.add(proj)
                db.flush()
                for u in annotators[:2]:
                    db.add(UserTagged(user_id=u.id, user_role=u.role, workspace_id=ws.id, project_id=proj.id, startdate=now, tagged_date=now))
                for u in reviewers[:1]:
                    db.add(UserTagged(user_id=u.id, user_role=u.role, workspace_id=ws.id, project_id=proj.id, startdate=now, tagged_date=now))
                # One batch and a couple of tasks per project
                batch = Batch(project_id=proj.id, name=f"Batch 1")
                db.add(batch)
                db.flush()
                for i in range(1, 4):
                    db.add(Task(batch_id=batch.id, content={"text": f"Task {i} for {pname}"}))
            ws.total_projects = db.query(Project).filter(Project.workspace_id == ws.id).count()
            ws.project_data = [{"projectId": p.id, "created_date": str(p.created_at)} for p in db.query(Project).filter(Project.workspace_id == ws.id).all()]
        db.commit()

        # Default workspace demo project (if none)
        if db.query(Project).filter(Project.workspace_id == ws_default.id).count() == 0:
            proj = Project(
                workspace_id=ws_default.id,
                external_id="PRJ-00002",
                name="Demo Annotation Project",
                description="Sample project with orchestration flow",
                profile_type="parent",
                pipeline_stages=["L1", "Review", "Done"],
                response_schema={"sentiment": "single_select", "notes": "free_text"},
                status="active",
                created_by_id=abhi.id,
            )
            db.add(proj)
            db.commit()
            db.refresh(proj)
            batch = Batch(project_id=proj.id, name="Batch 1")
            db.add(batch)
            db.commit()
            db.refresh(batch)
            for i in range(1, 4):
                db.add(Task(batch_id=batch.id, content={"text": f"Sample item {i}: Please label this text."}))
            db.commit()

        # Dummy Animal Image Annotation project: full workflow demo with "image" tasks
        proj_animals = db.query(Project).filter(Project.external_id == "PRJ-ANIMALS").first()
        if not proj_animals:
            ann = annotators[:2] if annotators else []
            rev = reviewers[:1] if reviewers else []
            proj_animals = Project(
                workspace_id=ws_default.id,
                external_id="PRJ-ANIMALS",
                name="Animal Image Labels (Demo)",
                description="Dummy project with animal images for end-to-end annotation and review workflow",
                profile_type="parent",
                pipeline_stages=["L1", "Review", "Done"],
                response_schema={"animal": "Dog, Cat, Bird, Other", "description": "free_text"},
                status="active",
                created_by_id=abhi.id,
                num_annotators=len(ann),
                num_reviewers=len(rev),
                annotator_ids=[u.id for u in ann],
                reviewer_ids=[u.id for u in rev],
            )
            db.add(proj_animals)
            db.commit()
            db.refresh(proj_animals)
            for u in ann:
                db.add(UserTagged(user_id=u.id, user_role=u.role, workspace_id=ws_default.id, project_id=proj_animals.id, startdate=now, tagged_date=now))
            for u in rev:
                db.add(UserTagged(user_id=u.id, user_role=u.role, workspace_id=ws_default.id, project_id=proj_animals.id, startdate=now, tagged_date=now))
            batch_anim = Batch(project_id=proj_animals.id, name="Animal Batch 1")
            db.add(batch_anim)
            db.commit()
            db.refresh(batch_anim)
            animal_tasks = [
                {"file": "dog1.jpg", "url": "https://placehold.co/400x300/eee/333?text=Dog"},
                {"file": "cat1.jpg", "url": "https://placehold.co/400x300/eee/333?text=Cat"},
                {"file": "bird1.jpg", "url": "https://placehold.co/400x300/eee/333?text=Bird"},
                {"file": "dog2.jpg", "url": "https://placehold.co/400x300/eee/333?text=Dog2"},
                {"file": "cat2.jpg", "url": "https://placehold.co/400x300/eee/333?text=Cat2"},
            ]
            for i, c in enumerate(animal_tasks):
                t = Task(batch_id=batch_anim.id, content=c, status="pending" if i > 2 else ("completed" if i == 0 else "in_progress"), pipeline_stage="Done" if i == 0 else ("Review" if i == 1 else "L1"))
                db.add(t)
                if i == 0 and ann:
                    t.claimed_by_id = ann[0].id
                    t.claimed_at = now
                elif i == 1 and ann:
                    t.claimed_by_id = ann[0].id
                    t.claimed_at = now
                    if rev:
                        t.assigned_reviewer_id = rev[0].id
            db.commit()

        # Ensure Super Admin (abhi) can act as annotator and reviewer for one-login demo
        for proj in [db.query(Project).filter(Project.external_id == "PRJ-ANIMALS").first(), db.query(Project).filter(Project.external_id == "PRJ-00001").first()]:
            if not proj or not abhi:
                continue
            aid = abhi.id
            annotator_ids = list(getattr(proj, "annotator_ids", None) or [])
            reviewer_ids = list(getattr(proj, "reviewer_ids", None) or [])
            if aid not in annotator_ids:
                annotator_ids.append(aid)
                proj.annotator_ids = annotator_ids
            if aid not in reviewer_ids:
                reviewer_ids.append(aid)
                proj.reviewer_ids = reviewer_ids
            proj.num_annotators = len(annotator_ids)
            proj.num_reviewers = len(reviewer_ids)
            if db.query(UserTagged).filter(UserTagged.user_id == aid, UserTagged.project_id == proj.id, UserTagged.user_role == "annotator").first() is None:
                db.add(UserTagged(user_id=aid, user_role="annotator", workspace_id=proj.workspace_id, project_id=proj.id, startdate=now, tagged_date=now))
            if db.query(UserTagged).filter(UserTagged.user_id == aid, UserTagged.project_id == proj.id, UserTagged.user_role == "reviewer").first() is None:
                db.add(UserTagged(user_id=aid, user_role="reviewer", workspace_id=proj.workspace_id, project_id=proj.id, startdate=now, tagged_date=now))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate_users_table()
    seed_db()
    yield


app = FastAPI(
    title="Annotation Studio V1",
    description="Enterprise data labeling with enhanced orchestration flow. Roles: Super Admin, Admin, Ops Manager, Annotator, Reviewer.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(workspaces_router.router)
app.include_router(projects_router.router)
app.include_router(activity_router.router)
app.include_router(batches_router.router)
app.include_router(tasks_router.router)
app.include_router(queue_router.router)
app.include_router(insight_router.router)
app.include_router(db_router.router)
app.include_router(requests_router.router)

frontend_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


@app.get("/")
def serve_app():
    index = frontend_path / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "Annotation Studio V1 API", "docs": "/docs"}


if frontend_path.exists():
    assets = frontend_path / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")
