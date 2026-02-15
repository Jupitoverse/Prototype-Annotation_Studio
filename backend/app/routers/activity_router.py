"""
Activity (orchestration node) API.
Each node has an API: accept request from previous node or admin, update DB, trigger next.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_ops

router = APIRouter(prefix="/activities", tags=["activities"])


# ---------- Activity specs (reference) ----------
@router.get("/specs", response_model=list[schemas.ActivitySpecResponse])
def list_specs(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return db.query(models.ActivitySpec).order_by(models.ActivitySpec.id).all()


@router.post("/specs", response_model=schemas.ActivitySpecResponse)
def create_spec(
    body: schemas.ActivitySpecCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    spec = models.ActivitySpec(
        spec_id=body.spec_id,
        name=body.name,
        description=body.description or "",
        api_endpoint=body.api_endpoint or "",
        node_type=body.node_type,
        config=body.config or {},
    )
    db.add(spec)
    db.commit()
    db.refresh(spec)
    return spec


# ---------- Activity instances (per project) ----------
@router.get("/instances", response_model=list[schemas.ActivityInstanceResponse])
def list_instances(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.ActivityInstance)
        .filter(models.ActivityInstance.project_id == project_id)
        .options(joinedload(models.ActivityInstance.spec))
        .order_by(models.ActivityInstance.created_at)
        .all()
    )
    return [schemas.ActivityInstanceResponse.model_validate(r) for r in rows]


@router.post("/instances", response_model=schemas.ActivityInstanceResponse)
def create_instance(
    body: schemas.ActivityInstanceCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    spec = db.query(models.ActivitySpec).filter(models.ActivitySpec.id == body.spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Activity spec not found")
    proj = db.query(models.Project).filter(models.Project.id == body.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    inst = models.ActivityInstance(
        project_id=body.project_id,
        spec_id=body.spec_id,
        child_project_id=body.child_project_id,
        next_instance_ids=body.next_instance_ids or [],
        node_type=body.node_type or spec.node_type,
        eta_minutes=body.eta_minutes,
        max_eta_minutes=body.max_eta_minutes,
        payload=body.payload or {},
        status="pending",
    )
    db.add(inst)
    db.commit()
    inst = db.query(models.ActivityInstance).options(joinedload(models.ActivityInstance.spec)).filter(models.ActivityInstance.id == inst.id).first()
    return schemas.ActivityInstanceResponse.model_validate(inst)


# ---------- Node API: trigger a node (from previous or admin). Updates DB and can trigger next. ----------
@router.post("/nodes/{instance_uid}/trigger")
def trigger_node(
    instance_uid: str,
    body: schemas.NodeTriggerRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    inst = db.query(models.ActivityInstance).filter(models.ActivityInstance.instance_uid == instance_uid).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Activity instance not found")
    inst.status = "in_progress"
    inst.start_date = inst.start_date or datetime.utcnow()
    inst.last_modified = datetime.utcnow()
    if body.trigger_by_user_id:
        inst.owner_id = body.trigger_by_user_id
    if body.payload:
        inst.payload = {**(inst.payload or {}), **body.payload}
    db.commit()
    db.refresh(inst)
    # In a full impl we would call next nodes' APIs here or enqueue jobs.
    return {"ok": True, "instance_uid": instance_uid, "status": inst.status, "message": "Node triggered; update DB and optionally trigger next nodes."}


@router.post("/nodes/{instance_uid}/complete")
def complete_node(
    instance_uid: str,
    body: schemas.NodeTriggerRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    inst = db.query(models.ActivityInstance).filter(models.ActivityInstance.instance_uid == instance_uid).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Activity instance not found")
    inst.status = "completed"
    inst.end_date = datetime.utcnow()
    inst.last_modified = datetime.utcnow()
    if body.payload:
        inst.payload = {**(inst.payload or {}), **body.payload}
    db.commit()
    db.refresh(inst)
    return {"ok": True, "instance_uid": instance_uid, "status": inst.status}


@router.post("/nodes/{instance_uid}/skip")
def skip_node(
    instance_uid: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    inst = db.query(models.ActivityInstance).filter(models.ActivityInstance.instance_uid == instance_uid).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Activity instance not found")
    inst.status = "skipped"
    inst.end_date = datetime.utcnow()
    inst.last_modified = datetime.utcnow()
    db.commit()
    db.refresh(inst)
    return {"ok": True, "instance_uid": instance_uid, "status": inst.status}
