"""
Task claim requests: annotator requests to take a task from someone else.
Approved by either the current assignee OR ops/admin/super_admin.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..auth import get_current_user, require_ops, ROLES_OPS

router = APIRouter(prefix="/requests", tags=["requests"])


class RequestCreate(BaseModel):
    task_id: int


class RequestResponse(BaseModel):
    id: int
    task_id: int
    requested_by_id: int
    current_assignee_id: int | None
    status: str
    approved_by_id: int | None
    created_at: datetime
    updated_at: datetime
    requested_by_email: str | None = None
    current_assignee_email: str | None = None
    approved_by_email: str | None = None

    class Config:
        from_attributes = True


def _can_approve(user: models.User, req: models.TaskClaimRequest) -> bool:
    if user.role in ROLES_OPS:
        return True
    if req.current_assignee_id and user.id == req.current_assignee_id:
        return True
    return False


@router.post("/claim", response_model=RequestResponse)
def create_claim_request(
    body: RequestCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Annotator (or same-project user) requests to claim a task. Creates pending request."""
    task = db.query(models.Task).filter(models.Task.id == body.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    batch = db.query(models.Batch).filter(models.Batch.id == task.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    project = db.query(models.Project).filter(models.Project.id == batch.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Requester must be annotator (or ops) and in project or workspace
    annotator_ids = getattr(project, "annotator_ids", None) or []
    if user.role not in ("annotator", "ops_manager", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only annotators can request to claim")
    if user.role == "annotator" and user.id not in annotator_ids:
        ws_ids = getattr(user, "workspace_ids", None) or []
        if project.workspace_id not in ws_ids:
            raise HTTPException(status_code=403, detail="Not in this project or workspace")
    if task.claimed_by_id == user.id:
        raise HTTPException(status_code=400, detail="You already own this task")
    existing = db.query(models.TaskClaimRequest).filter(
        models.TaskClaimRequest.task_id == body.task_id,
        models.TaskClaimRequest.requested_by_id == user.id,
        models.TaskClaimRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending request for this task")
    req = models.TaskClaimRequest(
        task_id=body.task_id,
        requested_by_id=user.id,
        current_assignee_id=task.claimed_by_id,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return RequestResponse.model_validate(req)


@router.get("", response_model=list[RequestResponse])
def list_requests(
    status: str | None = Query(None),
    requested_by_id: int | None = Query(None),
    task_id: int | None = Query(None),
    project_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List claim requests. Ops see all; annotators see their own + where they are assignee."""
    q = db.query(models.TaskClaimRequest)
    if user.role not in ROLES_OPS:
        q = q.filter(
            (models.TaskClaimRequest.requested_by_id == user.id) |
            (models.TaskClaimRequest.current_assignee_id == user.id)
        )
    if status:
        q = q.filter(models.TaskClaimRequest.status == status)
    if requested_by_id is not None:
        q = q.filter(models.TaskClaimRequest.requested_by_id == requested_by_id)
    if task_id is not None:
        q = q.filter(models.TaskClaimRequest.task_id == task_id)
    if project_id is not None:
        q = q.join(models.Task).join(models.Batch).filter(models.Batch.project_id == project_id)
    rows = q.order_by(models.TaskClaimRequest.created_at.desc()).all()
    user_ids = set()
    for r in rows:
        user_ids.add(r.requested_by_id)
        if r.current_assignee_id:
            user_ids.add(r.current_assignee_id)
        if r.approved_by_id:
            user_ids.add(r.approved_by_id)
    users = {u.id: u for u in db.query(models.User).filter(models.User.id.in_(user_ids)).all()} if user_ids else {}
    out = []
    for r in rows:
        d = RequestResponse.model_validate(r).model_dump()
        u_req = users.get(r.requested_by_id)
        u_assignee = users.get(r.current_assignee_id) if r.current_assignee_id else None
        u_approver = users.get(r.approved_by_id) if r.approved_by_id else None
        d["requested_by_email"] = (u_req.email or getattr(u_req, "full_name", "") or "") if u_req else ""
        d["current_assignee_email"] = (u_assignee.email or getattr(u_assignee, "full_name", "") or "") if u_assignee else ""
        d["approved_by_email"] = (u_approver.email or getattr(u_approver, "full_name", "") or "") if u_approver else ""
        out.append(RequestResponse(**d))
    return out


@router.post("/claim/{request_id}/approve")
def approve_claim_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Approve: assignee OR ops. Transfers task to requester."""
    req = db.query(models.TaskClaimRequest).filter(models.TaskClaimRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is no longer pending")
    if not _can_approve(user, req):
        raise HTTPException(status_code=403, detail="Only assignee or Ops/Admin can approve")
    task = db.query(models.Task).filter(models.Task.id == req.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    req.status = "approved"
    req.approved_by_id = user.id
    task.claimed_by_id = req.requested_by_id
    task.claimed_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "request_id": request_id, "task_id": task.id}


@router.post("/claim/{request_id}/reject")
def reject_claim_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Reject: assignee OR ops."""
    req = db.query(models.TaskClaimRequest).filter(models.TaskClaimRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is no longer pending")
    if not _can_approve(user, req):
        raise HTTPException(status_code=403, detail="Only assignee or Ops/Admin can reject")
    req.status = "rejected"
    req.approved_by_id = user.id
    db.commit()
    return {"ok": True, "request_id": request_id}
