from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_ops

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _task_to_response(task: models.Task) -> schemas.TaskResponse:
    now = datetime.utcnow()
    ref = task.claimed_at or task.created_at
    age_days = round((now - ref).total_seconds() / 86400, 2) if ref else None
    due = getattr(task, "due_at", None)
    remaining_days = round((due - now).total_seconds() / 86400, 2) if due else None
    return schemas.TaskResponse(
        id=task.id,
        batch_id=task.batch_id,
        status=task.status,
        pipeline_stage=task.pipeline_stage,
        content=task.content or {},
        claimed_by_id=task.claimed_by_id,
        claimed_at=task.claimed_at,
        assigned_reviewer_id=task.assigned_reviewer_id,
        due_at=due,
        rework_count=getattr(task, "rework_count", None) or 0,
        draft_response=getattr(task, "draft_response", None),
        created_at=task.created_at,
        updated_at=task.updated_at,
        age_days=age_days,
        remaining_days=remaining_days,
    )


@router.get("", response_model=list[schemas.TaskResponse])
def list_tasks(
    batch_id: int | None = Query(None),
    project_id: int | None = Query(None),
    workspace_id: int | None = Query(None),
    status: str | None = Query(None),
    pipeline_stage: str | None = Query(None),
    claimed_by_id: int | None = Query(None, description="Filter by annotator (claimed by user id)"),
    assigned_reviewer_id: int | None = Query(None, description="Filter by reviewer (assigned reviewer id)"),
    date_from: str | None = Query(None, description="Filter tasks updated on or after (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="Filter tasks updated on or before (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = db.query(models.Task)
    if batch_id is not None:
        q = q.filter(models.Task.batch_id == batch_id)
    if project_id is not None or workspace_id is not None:
        q = q.join(models.Batch)
    if project_id is not None:
        q = q.filter(models.Batch.project_id == project_id)
    if workspace_id is not None:
        q = q.join(models.Project, models.Batch.project_id == models.Project.id).filter(models.Project.workspace_id == workspace_id)
    if status:
        q = q.filter(models.Task.status == status)
    if pipeline_stage:
        q = q.filter(models.Task.pipeline_stage == pipeline_stage)
    if claimed_by_id is not None:
        q = q.filter(models.Task.claimed_by_id == claimed_by_id)
    if assigned_reviewer_id is not None:
        q = q.filter(models.Task.assigned_reviewer_id == assigned_reviewer_id)
    if date_from:
        try:
            from datetime import datetime as dt
            q = q.filter(models.Task.updated_at >= dt.strptime(date_from, "%Y-%m-%d"))
        except ValueError:
            pass
    if date_to:
        try:
            from datetime import datetime as dt
            q = q.filter(models.Task.updated_at < dt.strptime(date_to, "%Y-%m-%d") + dt.timedelta(days=1))
        except ValueError:
            pass
    tasks = q.order_by(models.Task.created_at.desc()).all()
    return [_task_to_response(t) for t in tasks]


@router.post("", response_model=schemas.TaskResponse)
def create_task(
    body: schemas.TaskCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    batch = db.query(models.Batch).filter(models.Batch.id == body.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    task = models.Task(
        batch_id=body.batch_id,
        pipeline_stage=body.pipeline_stage or "L1",
        content=body.content or {},
        status="pending",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_to_response(task)


@router.post("/bulk", response_model=list[schemas.TaskResponse])
def bulk_create_tasks(
    body: schemas.TaskBulkCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    batch = db.query(models.Batch).filter(models.Batch.id == body.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    created = []
    for item in body.items:
        task = models.Task(batch_id=body.batch_id, content=item if isinstance(item, dict) else {"text": str(item)}, status="pending", pipeline_stage="L1")
        db.add(task)
        db.flush()
        created.append(task)
    db.commit()
    for t in created:
        db.refresh(t)
    return [_task_to_response(t) for t in created]


@router.get("/{task_id}", response_model=schemas.TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_to_response(task)


@router.get("/{task_id}/annotations", response_model=list[schemas.AnnotationResponse])
def get_task_annotations(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return list(task.annotations)


@router.patch("/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: int,
    body: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return _task_to_response(task)
