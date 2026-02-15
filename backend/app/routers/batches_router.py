from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_ops

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("", response_model=list[schemas.BatchResponse])
def list_batches(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return db.query(models.Batch).filter(models.Batch.project_id == project_id).order_by(models.Batch.created_at.desc()).all()


@router.post("", response_model=schemas.BatchResponse)
def create_batch(
    body: schemas.BatchCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    proj = db.query(models.Project).filter(models.Project.id == body.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    batch = models.Batch(project_id=body.project_id, name=body.name)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/{batch_id}", response_model=schemas.BatchResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.delete("/{batch_id}", status_code=204)
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    db.commit()
    return None
