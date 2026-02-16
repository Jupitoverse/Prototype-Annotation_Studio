from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_ops, require_annotator, require_reviewer, ROLES_OPS, ROLES_ANNOTATOR
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


@router.get("/batch/{batch_id}/tasks", response_model=list[schemas.TaskResponse])
def batch_tasks_for_annotator(
    batch_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_annotator),
):
    """Tasks in batch that annotator can work on: claimed by me or unclaimed. Non-skipped first, then by created_at. Skipped at end."""
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    project = db.query(models.Project).filter(models.Project.id == batch.project_id).first()
    if not project or not _user_can_claim_annotator(project, user):
        raise HTTPException(status_code=403, detail="Not assigned to this project")
    from sqlalchemy import case
    tasks = (
        db.query(models.Task)
        .filter(
            models.Task.batch_id == batch_id,
            models.Task.pipeline_stage == "L1",
            (models.Task.claimed_by_id == user.id) | (models.Task.claimed_by_id.is_(None)),
            models.Task.status.in_(["pending", "in_progress", "skipped"]),
        )
        .order_by(case((models.Task.status == "skipped", 1), else_=0), models.Task.created_at)
        .all()
    )
    return [_task_to_response(t) for t in tasks]


@router.post("/tasks/{task_id}/claim")
def claim_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Claim an unassigned task (or, if Ops/Admin, claim any task including reassigning)."""
    if user.role not in ROLES_ANNOTATOR:
        raise HTTPException(status_code=403, detail="Annotator or Ops access required")
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    batch = db.query(models.Batch).filter(models.Batch.id == task.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    project = db.query(models.Project).filter(models.Project.id == batch.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if task.claimed_by_id is not None and task.claimed_by_id != user.id:
        if user.role not in ROLES_OPS:
            raise HTTPException(status_code=403, detail="Task already claimed by someone else")
        # Ops can reassign to self
    elif task.claimed_by_id == user.id:
        db.commit()
        return _task_to_response(task)
    else:
        if not _user_can_claim_annotator(project, user):
            raise HTTPException(status_code=403, detail="Not assigned to this project")
    task.claimed_by_id = user.id
    task.claimed_at = datetime.utcnow()
    task.status = "in_progress"
    db.commit()
    db.refresh(task)
    return _task_to_response(task)


@router.post("/tasks/{task_id}/save-draft")
def save_draft(
    task_id: int,
    body: schemas.AnnotationBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_annotator),
):
    """Auto-save partial annotation without submitting for review."""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.claimed_by_id != user.id:
        raise HTTPException(status_code=403, detail="Not your task")
    task.draft_response = body.response
    db.commit()
    return {"ok": True, "task_id": task_id}


@router.post("/tasks/{task_id}/skip")
def skip_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_annotator),
):
    """Mark task as skipped; annotator can revisit skipped items later."""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.claimed_by_id != user.id:
        raise HTTPException(status_code=403, detail="Not your task")
    task.status = "skipped"
    db.commit()
    return {"ok": True, "task_id": task_id}


@router.post("/tasks/{task_id}/unskip")
def unskip_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_annotator),
):
    """Clear skipped so task appears again in queue."""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.claimed_by_id != user.id:
        raise HTTPException(status_code=403, detail="Not your task")
    task.status = "in_progress"
    db.commit()
    return {"ok": True, "task_id": task_id}


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
    task.draft_response = None
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


def _check_project_ready_for_export(db: Session, project_id: int) -> bool:
    """Return True if every task in the project is completed (so project is ready for export)."""
    from sqlalchemy import func
    total = db.query(models.Task).join(models.Batch).filter(models.Batch.project_id == project_id).count()
    if total == 0:
        return False
    completed = (
        db.query(models.Task)
        .join(models.Batch)
        .filter(models.Batch.project_id == project_id, models.Task.status == "completed")
        .count()
    )
    return total == completed


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
    # If all tasks in this project are now completed, mark project as ready for export
    batch = db.query(models.Batch).filter(models.Batch.id == task.batch_id).first()
    if batch and _check_project_ready_for_export(db, batch.project_id):
        project = db.query(models.Project).filter(models.Project.id == batch.project_id).first()
        if project:
            project.status = "ready_for_export"
            db.commit()
    return {"ok": True, "task_id": task_id}


@router.post("/review/{task_id}/reject")
def reject_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_reviewer),
):
    """Send back for re-labelling: same annotator must redo; rework_count incremented."""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    last_ann = db.query(models.Annotation).filter(models.Annotation.task_id == task_id).order_by(models.Annotation.created_at.desc()).first()
    annotator_id = last_ann.user_id if last_ann else None
    task.pipeline_stage = "L1"
    task.status = "in_progress" if annotator_id else "pending"
    task.claimed_by_id = annotator_id
    task.claimed_at = datetime.utcnow() if annotator_id else None
    task.rework_count = (getattr(task, "rework_count", 0) or 0) + 1
    task.draft_response = None
    db.commit()
    return {"ok": True, "task_id": task_id}


@router.get("/stats/efficiency")
def annotator_efficiency(
    project_id: int | None = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_annotator),
):
    """Efficiency for current annotator: (total completed - sent back) / total. Optional project_id filter."""
    q = db.query(models.Task).filter(models.Task.status == "completed")
    if project_id is not None:
        q = q.join(models.Batch).filter(models.Batch.project_id == project_id)
    completed_tasks = q.all()
    if not completed_tasks:
        return {"total_completed": 0, "sent_back_count": 0, "efficiency_percent": 100.0}
    task_ids = [t.id for t in completed_tasks]
    anns = (
        db.query(models.Annotation)
        .filter(models.Annotation.task_id.in_(task_ids))
        .order_by(models.Annotation.task_id, models.Annotation.created_at.desc())
        .all()
    )
    last_annotator_by_task = {}
    for a in anns:
        if a.task_id not in last_annotator_by_task:
            last_annotator_by_task[a.task_id] = a.user_id
    my_task_ids = [tid for tid, uid in last_annotator_by_task.items() if uid == user.id]
    total = len(my_task_ids)
    if total == 0:
        return {"total_completed": 0, "sent_back_count": 0, "efficiency_percent": 100.0}
    task_id_set = set(my_task_ids)
    sent_back = sum(
        1 for t in completed_tasks if t.id in task_id_set and (getattr(t, "rework_count", 0) or 0) > 0
    )
    efficiency = round((total - sent_back) / total * 100.0, 1)
    return {
        "total_completed": total,
        "sent_back_count": sent_back,
        "efficiency_percent": efficiency,
    }
