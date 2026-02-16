from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import models
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/insight", tags=["insight"])


def _word_count_from_json(obj):
    """Recursively sum word count from JSON (strings only)."""
    if obj is None:
        return 0
    if isinstance(obj, str):
        return len(obj.split())
    if isinstance(obj, dict):
        return sum(_word_count_from_json(v) for v in obj.values())
    if isinstance(obj, list):
        return sum(_word_count_from_json(v) for v in obj)
    return 0


@router.get("/stats")
def get_insight_stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Return workspace, project, task, and user counts for the Insight tab."""
    workspace_total = db.query(models.Workspace).count()
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
    user_counts = (
        db.query(models.User.role, func.count(models.User.id))
        .group_by(models.User.role)
        .all()
    )
    projects_by_status = {str(s): c for s, c in project_counts}
    tasks_by_status = {str(s): c for s, c in task_counts}
    users_by_role = {str(r): c for r, c in user_counts}
    return {
        "workspaces": {"total": workspace_total},
        "projects": {
            "total": sum(projects_by_status.values()),
            "by_status": projects_by_status,
        },
        "tasks": {
            "total": sum(tasks_by_status.values()),
            "by_status": tasks_by_status,
        },
        "users": {
            "total": sum(users_by_role.values()),
            "by_role": users_by_role,
        },
    }


@router.get("/project/{project_id}/annotator-report")
def get_project_annotator_report(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Per-project annotator statistics: assigned, accepted, unlabeled, skipped, draft, word count, avg annotation time."""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    annotator_ids = list(getattr(project, "annotator_ids", None) or [])
    if not annotator_ids:
        users_in_project = (
            db.query(models.User.id)
            .join(models.UserTagged, models.UserTagged.user_id == models.User.id)
            .filter(models.UserTagged.project_id == project_id, models.UserTagged.user_role == "annotator")
            .distinct()
            .all()
        )
        annotator_ids = [u.id for u in users_in_project]
    if not annotator_ids:
        return {"project_id": project_id, "project_name": project.name, "annotators": []}

    # Tasks in this project (via batch)
    batch_ids = [b.id for b in db.query(models.Batch.id).filter(models.Batch.project_id == project_id).all()]
    if not batch_ids:
        return {"project_id": project_id, "project_name": project.name, "annotators": []}

    tasks_in_project = (
        db.query(models.Task)
        .filter(models.Task.batch_id.in_(batch_ids))
        .all()
    )
    task_ids = [t.id for t in tasks_in_project]
    tasks_by_id = {t.id: t for t in tasks_in_project}

    # Annotations in these tasks
    anns = (
        db.query(models.Annotation)
        .filter(models.Annotation.task_id.in_(task_ids))
        .order_by(models.Annotation.task_id, models.Annotation.created_at)
        .all()
    )
    # First and last annotation per (task_id, user_id) for time calc
    first_ann_by_task_user = {}
    for a in anns:
        key = (a.task_id, a.user_id)
        if key not in first_ann_by_task_user:
            first_ann_by_task_user[key] = a

    task_ids_by_annotator = {}  # uid -> set of task_ids they have annotated
    for a in anns:
        if a.user_id not in task_ids_by_annotator:
            task_ids_by_annotator[a.user_id] = set()
        task_ids_by_annotator[a.user_id].add(a.task_id)

    users = {u.id: u for u in db.query(models.User).filter(models.User.id.in_(annotator_ids)).all()}
    report = []
    for uid in annotator_ids:
        u = users.get(uid)
        if not u:
            continue
        annotated_task_ids = task_ids_by_annotator.get(uid) or set()
        assigned_ids = {t.id for t in tasks_in_project if t.claimed_by_id == uid or t.id in annotated_task_ids}
        assigned = len(assigned_ids)
        accepted = sum(1 for t in tasks_in_project if t.status == "completed" and t.id in annotated_task_ids)
        unlabeled = sum(1 for t in tasks_in_project if t.claimed_by_id == uid and t.status in ("pending", "in_progress"))
        skipped = sum(1 for t in tasks_in_project if t.status == "skipped" and t.claimed_by_id == uid)
        draft = sum(1 for t in tasks_in_project if t.claimed_by_id == uid and getattr(t, "draft_response", None) is not None)
        word_count = 0
        times_seconds = []
        for a in anns:
            if a.user_id != uid:
                continue
            word_count += _word_count_from_json(a.response)
            task = tasks_by_id.get(a.task_id)
            if task and getattr(task, "claimed_at", None):
                first_ann = first_ann_by_task_user.get((a.task_id, uid))
                if first_ann and first_ann.id == a.id:
                    delta = (a.created_at - task.claimed_at).total_seconds()
                    if delta >= 0:
                        times_seconds.append(delta)
        avg_time = round(sum(times_seconds) / len(times_seconds), 2) if times_seconds else None
        report.append({
            "user_id": u.id,
            "annotator": getattr(u, "full_name", None) or " ".join(filter(None, [getattr(u, "first_name", ""), getattr(u, "last_name", "")])).strip() or u.email,
            "email": u.email,
            "assigned_tasks": assigned,
            "accepted_tasks": accepted,
            "unlabeled_tasks": unlabeled,
            "skipped_tasks": skipped,
            "draft_tasks": draft,
            "word_count": word_count,
            "average_annotation_time_seconds": avg_time,
        })
    return {
        "project_id": project_id,
        "project_name": project.name,
        "annotators": report,
    }


@router.get("/project-progress")
def get_project_progress(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List all projects with task counts (total and completed) for progress bars."""
    projects = db.query(models.Project).order_by(models.Project.updated_at.desc()).all()
    out = []
    for p in projects:
        batch_ids = [b.id for b in db.query(models.Batch.id).filter(models.Batch.project_id == p.id).all()]
        total = 0
        completed = 0
        if batch_ids:
            total = db.query(models.Task).filter(models.Task.batch_id.in_(batch_ids)).count()
            completed = (
                db.query(models.Task)
                .filter(models.Task.batch_id.in_(batch_ids), models.Task.status == "completed")
                .count()
            )
        out.append({
            "project_id": p.id,
            "project_name": p.name,
            "status": getattr(p, "status", None) or "active",
            "total_tasks": total,
            "completed_tasks": completed,
        })
    return {"projects": out}
