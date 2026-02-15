from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_ops

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[schemas.WorkspaceResponse])
def list_workspaces(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return db.query(models.Workspace).all()


@router.post("", response_model=schemas.WorkspaceResponse)
def create_workspace(
    body: schemas.WorkspaceCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    ws = models.Workspace(
        name=body.name,
        description=body.description or "",
        created_by_id=user.id,
        total_projects=0,
        status="active",
        project_data=[],
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return ws


@router.get("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def get_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.patch("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def update_workspace(
    workspace_id: int,
    body: schemas.WorkspaceBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    ws.name = body.name
    ws.description = body.description or ""
    db.commit()
    db.refresh(ws)
    return ws


@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    db.delete(ws)
    db.commit()
    return None
