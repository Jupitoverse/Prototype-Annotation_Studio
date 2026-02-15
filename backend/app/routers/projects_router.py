import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_ops

router = APIRouter(prefix="/projects", tags=["projects"])


def generate_next_project_id(db: Session) -> str:
    """Generate unique project_id (external_id) e.g. PRJ-00001, PRJ-00002."""
    rows = db.query(models.Project.external_id).filter(
        models.Project.external_id.isnot(None),
        models.Project.external_id.like("PRJ-%"),
    ).all()
    max_num = 0
    for (ext_id,) in rows:
        if ext_id:
            m = re.match(r"PRJ-(\d+)", ext_id, re.I)
            if m:
                max_num = max(max_num, int(m.group(1)))
    return f"PRJ-{max_num + 1:05d}"


@router.get("/my-assignments", response_model=list[schemas.MyAssignmentResponse])
def my_assignments(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Projects where current user is assigned as annotator or reviewer, with % and ETA."""
    out = []
    projects = db.query(models.Project).filter(models.Project.status.in_(["active", "draft"])).order_by(models.Project.updated_at.desc()).all()
    for p in projects:
        a_ids = p.annotator_ids if isinstance(getattr(p, "annotator_ids", None), list) else []
        r_ids = p.reviewer_ids if isinstance(getattr(p, "reviewer_ids", None), list) else []
        a_pct = getattr(p, "annotator_pct", None) or []
        r_pct = getattr(p, "reviewer_pct", None) or []
        a_eta = getattr(p, "annotator_eta_days", None) or []
        r_eta = getattr(p, "reviewer_eta_days", None) or []
        if not isinstance(a_pct, list):
            a_pct = []
        if not isinstance(r_pct, list):
            r_pct = []
        if not isinstance(a_eta, list):
            a_eta = []
        if not isinstance(r_eta, list):
            r_eta = []
        try:
            idx = a_ids.index(user.id)
            out.append(schemas.MyAssignmentResponse(
                project_id=p.id,
                project_name=p.name,
                external_id=getattr(p, "external_id", None),
                workspace_id=p.workspace_id,
                role="annotator",
                percent=float(a_pct[idx]) if idx < len(a_pct) else 0.0,
                eta_days=float(a_eta[idx]) if idx < len(a_eta) and a_eta[idx] is not None else None,
                status=p.status,
            ))
        except (ValueError, TypeError):
            pass
        try:
            idx = r_ids.index(user.id)
            out.append(schemas.MyAssignmentResponse(
                project_id=p.id,
                project_name=p.name,
                external_id=getattr(p, "external_id", None),
                workspace_id=p.workspace_id,
                role="reviewer",
                percent=float(r_pct[idx]) if idx < len(r_pct) else 0.0,
                eta_days=float(r_eta[idx]) if idx < len(r_eta) and r_eta[idx] is not None else None,
                status=p.status,
            ))
        except (ValueError, TypeError):
            pass
    return out


@router.get("", response_model=list[schemas.ProjectResponse])
def list_projects(
    workspace_id: int | None = Query(None),
    parent_id: int | None = Query(None),
    profile_type: str | None = Query(None),
    status: str | None = Query(None),
    name_contains: str | None = Query(None, description="Filter by project name (case-insensitive substring)"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = db.query(models.Project)
    if workspace_id is not None:
        q = q.filter(models.Project.workspace_id == workspace_id)
    if parent_id is not None:
        q = q.filter(models.Project.parent_id == parent_id)
    if profile_type:
        q = q.filter(models.Project.profile_type == profile_type)
    if status:
        q = q.filter(models.Project.status == status)
    if name_contains and name_contains.strip():
        q = q.filter(models.Project.name.ilike(f"%{name_contains.strip()}%"))
    return q.order_by(models.Project.updated_at.desc()).all()


@router.post("", response_model=schemas.ProjectResponse)
def create_project(
    body: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    external_id = body.external_id if (body.external_id and body.external_id.strip()) else generate_next_project_id(db)
    proj = models.Project(
        workspace_id=body.workspace_id,
        parent_id=body.parent_id,
        external_id=external_id,
        name=body.name,
        description=body.description or "",
        profile_type=body.profile_type,
        pipeline_template=body.pipeline_template,
        pipeline_stages=body.pipeline_stages or ["L1", "Review", "Done"],
        response_schema=body.response_schema or {},
        status=body.status or "draft",
        created_by_id=user.id,
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj


@router.get("/{project_id}", response_model=schemas.ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@router.patch("/{project_id}", response_model=schemas.ProjectResponse)
def update_project(
    project_id: int,
    body: schemas.ProjectBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(proj, k, v)
    db.commit()
    db.refresh(proj)
    return proj


@router.get("/{project_id}/children", response_model=list[schemas.ProjectResponse])
def list_children(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return db.query(models.Project).filter(models.Project.parent_id == project_id).order_by(models.Project.created_at).all()


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(proj)
    db.commit()
    return None


@router.post("/{project_id}/create-default-workflow")
def create_default_workflow(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    """Create default orchestration flow: Start → Configure/Dataset → Assign Annotator → Annotate (manual) → Review → End."""
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    if db.query(models.ActivityInstance).filter(models.ActivityInstance.project_id == project_id).count() > 0:
        return {"message": "Workflow already has nodes", "project_id": project_id}
    specs = {s.spec_id: s for s in db.query(models.ActivitySpec).all()}
    if not specs:
        raise HTTPException(status_code=500, detail="Activity specs not seeded")
    # Build chain: start -> configure -> assign -> annotate (manual) -> review -> end
    labels = [
        ("start", "Start"),
        ("normal", "Configure Project / Dataset"),
        ("normal", "Assign Annotator"),
        ("manual", "Annotate"),
        ("normal", "Review"),
        ("end", "End"),
    ]
    created = []
    for i, (spec_id_key, name) in enumerate(labels):
        spec = specs.get(spec_id_key) or specs.get("normal")
        if not spec:
            continue
        inst = models.ActivityInstance(
            project_id=project_id,
            spec_id=spec.id,
            node_type=spec.node_type,
            status="pending" if i > 0 else "completed",
            payload={"label": name},
        )
        db.add(inst)
        db.flush()
        created.append((inst.instance_uid, name))
    for i in range(len(created) - 1):
        inst = db.query(models.ActivityInstance).filter(
            models.ActivityInstance.project_id == project_id,
            models.ActivityInstance.instance_uid == created[i][0],
        ).first()
        if inst:
            inst.next_instance_ids = [created[i + 1][0]]
    db.commit()
    return {"ok": True, "project_id": project_id, "nodes": len(created)}
