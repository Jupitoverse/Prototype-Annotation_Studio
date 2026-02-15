from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import models
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/insight", tags=["insight"])


@router.get("/stats")
def get_insight_stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Return project and task counts by status for the Insight tab."""
    project_counts = (
        db.query(models.Project.status, func.count(models.Project.id))
        .group_by(models.Project.status)
        .all()
    )
    task_counts = (
        db.query(models.Task.status, func.count(models.Task.id))
        .group_by(models.Task.status)
        .all()
    )
    projects_by_status = {str(s): c for s, c in project_counts}
    tasks_by_status = {str(s): c for s, c in task_counts}
    return {
        "projects": {
            "total": sum(projects_by_status.values()),
            "by_status": projects_by_status,
        },
        "tasks": {
            "total": sum(tasks_by_status.values()),
            "by_status": tasks_by_status,
        },
    }
