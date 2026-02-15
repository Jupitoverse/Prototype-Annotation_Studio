from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_ops, require_annotator, require_reviewer, ROLES_OPS
from ..routers.tasks_router import _task_to_response

router = APIRouter(prefix="/queue", tags=["queue"])


def _user_can_claim_annotator(project: models.Project, user: models.User) -> bool:
    if user.role in ROLES_OPS:
        return True
    ids = getattr(project, "annotator_ids", None) or []
    return isinstance(ids, list) and user.id in ids


@router.get("/next", response_model=schemas.TaskResponse | None)
def get_next_task(
    batch_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_annotator),
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    project = db.query(models.Project).filter(models.Project.id == batch.project_id).first()
    if not project or not _user_can_claim_annotator(project, user):
        raise HTTPException(status_code=403, detail="Not assigned to this project as annotator")
    task = (
        db.query(models.Task)
        .filter(models.Task.batch_id == batch_id, models.Task.status == "pending", models.Task.claimed_by_id.is_(None), models.Task.pipeline_stage == "L1")
        .order_by(models.Task.created_at)
        .first()
    )
    if not task:
        return None
    task.claimed_by_id = user.id
    task.claimed_at = datetime.utcnow()
    task.status = "in_progress"
    db.commit()
    db.refresh(task)
    return _task_to_response(task)


@router.get("/my-tasks", response_model=list[schemas.TaskResponse])
def my_tasks(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_annotator),
):
    tasks = db.query(models.Task).filter(models.Task.claimed_by_id == user.id, models.Task.status == "in_progress").order_by(models.Task.claimed_at).all()
    return [_task_to_response(t) for t in tasks]


@router.post("/tasks/{task_id}/submit")
def submit_for_review(
    task_id: int,
    body: schemas.AnnotationBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_annotator),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.claimed_by_id != user.id:
        raise HTTPException(status_code=403, detail="Not your task")
    ann = models.Annotation(task_id=task_id, user_id=user.id, response=body.response, pipeline_stage=body.pipeline_stage)
    db.add(ann)
    task.pipeline_stage = "Review"
    task.status = "pending"
    task.claimed_by_id = None
    task.claimed_at = None
    db.commit()
    return {"ok": True, "task_id": task_id}


@router.get("/review", response_model=list[schemas.TaskResponse])
def review_queue(
    project_id: int | None = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_reviewer),
):
    q = (
        db.query(models.Task)
        .join(models.Batch)
        .filter(models.Task.pipeline_stage == "Review", models.Task.status == "pending")
    )
    if project_id is not None:
        q = q.filter(models.Batch.project_id == project_id)
    q = q.filter((models.Task.assigned_reviewer_id == user.id) | (models.Task.assigned_reviewer_id.is_(None)))
    tasks = q.order_by(models.Task.updated_at).all()
    return [_task_to_response(t) for t in tasks]


@router.post("/review/{task_id}/approve")
def approve_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_reviewer),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.pipeline_stage = "Done"
    task.status = "completed"
    db.commit()
    return {"ok": True, "task_id": task_id}


@router.post("/review/{task_id}/reject")
def reject_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_reviewer),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.pipeline_stage = "L1"
    task.status = "pending"
    task.claimed_by_id = None
    task.claimed_at = None
    db.commit()
    return {"ok": True, "task_id": task_id}
