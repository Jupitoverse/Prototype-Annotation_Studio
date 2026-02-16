"""
Data model for Annotation Studio V1.
Orchestration: ActivitySpec (reference) + ActivityInstance (per project run).
Projects can be parent/annotator/review/reassignment; parent_id for hierarchy.
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    """user_management table: all user profiles created by Ops/Admin."""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    userid = Column(String(50), unique=True, index=True, nullable=True)  # u1, u2, u3... (auto on create)
    external_id = Column(String(50), unique=True, index=True, nullable=True)  # legacy alias for userid
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), default="")
    middle_name = Column(String(100), default="")
    last_name = Column(String(100), default="")
    full_name = Column(String(255), default="")
    role = Column(String(50), nullable=False, default="annotator")
    availability = Column(String(20), default="100%")  # 100%, 50%, 25%, 75%
    max_load = Column(Integer, default=50)  # max tasks/items
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True, index=True)
    workspace_ids = Column(JSON, default=list)
    mobile = Column(String(50), nullable=True)
    company_id = Column(String(100), nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="users", foreign_keys=[workspace_id])
    tagged = relationship("UserTagged", back_populates="user", foreign_keys="UserTagged.user_id")


class Workspace(Base):
    """Workspace table: all workspaces; data isolated per workspace."""
    __tablename__ = "workspaces"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    total_projects = Column(Integer, default=0)
    status = Column(String(50), default="active")  # active, closed
    close_date = Column(DateTime, nullable=True)
    project_data = Column(JSON, default=list)  # [{projectId, created_date}, ...]
    projects = relationship("Project", back_populates="workspace", foreign_keys="Project.workspace_id")
    media = relationship("Media", back_populates="workspace", foreign_keys="Media.workspace_id")
    users = relationship("User", back_populates="workspace", foreign_keys="User.workspace_id")
    created_by = relationship("User", foreign_keys=[created_by_id])
    user_tagged = relationship("UserTagged", back_populates="workspace", foreign_keys="UserTagged.workspace_id")


class Media(Base):
    """Media table: metadata for files attached to projects. Join key: id (and project_id, workspace_id)."""
    __tablename__ = "media"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    file_type = Column(String(100), nullable=True)  # extension or MIME
    file_name = Column(String(512), nullable=True)
    size_bytes = Column(Integer, default=0)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    external_id = Column(String(100), unique=True, index=True, nullable=True)  # join/correlation key

    project = relationship("Project", back_populates="media", foreign_keys=[project_id])
    workspace = relationship("Workspace", back_populates="media", foreign_keys=[workspace_id])
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    external_id = Column(String(100), unique=True, index=True, nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    profile_type = Column(String(50), nullable=False, default="parent")
    pipeline_template = Column(String(100), nullable=True)
    pipeline_stages = Column(JSON, default=lambda: ["L1", "Review", "Done"])
    response_schema = Column(JSON, default=dict)
    status = Column(String(50), default="draft")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    num_annotators = Column(Integer, default=0)
    num_reviewers = Column(Integer, default=0)
    close_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    annotator_ids = Column(JSON, default=list)  # [user_id, ...]
    reviewer_ids = Column(JSON, default=list)
    annotator_pct = Column(JSON, default=list)  # [pct, ...] same order as annotator_ids
    reviewer_pct = Column(JSON, default=list)
    annotator_eta_days = Column(JSON, default=list)  # [days or null, ...] ETA working days per annotator
    reviewer_eta_days = Column(JSON, default=list)

    workspace = relationship("Workspace", back_populates="projects", foreign_keys=[workspace_id])
    media = relationship("Media", back_populates="project", foreign_keys="Media.project_id")
    parent = relationship("Project", remote_side=[id], back_populates="children")
    children = relationship("Project", back_populates="parent", foreign_keys=[parent_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    close_by = relationship("User", foreign_keys=[close_by_id])
    batches = relationship("Batch", back_populates="project", order_by="Batch.created_at")
    activity_instances = relationship(
        "ActivityInstance",
        primaryjoin="ActivityInstance.project_id==Project.id",
        back_populates="project",
        order_by="ActivityInstance.created_at",
    )
    user_tagged = relationship("UserTagged", back_populates="project", foreign_keys="UserTagged.project_id")


class UserTagged(Base):
    """User_tagged: one row per (user, workspace, project) with start/end dates."""
    __tablename__ = "user_tagged"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_role = Column(String(50), nullable=False)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    startdate = Column(DateTime, nullable=True)
    enddate = Column(DateTime, nullable=True)
    tagged_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="tagged", foreign_keys=[user_id])
    workspace = relationship("Workspace", back_populates="user_tagged", foreign_keys=[workspace_id])
    project = relationship("Project", back_populates="user_tagged", foreign_keys=[project_id])


class ActivitySpec(Base):
    """Reference table: static definition of an activity/node type."""
    __tablename__ = "activity_specs"
    id = Column(Integer, primary_key=True, index=True)
    spec_id = Column(String(100), unique=True, index=True, nullable=False)  # unique spec id
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    api_endpoint = Column(String(255), default="")  # e.g. /api/nodes/start
    # start | end | normal | skipped | group | manual
    node_type = Column(String(50), nullable=False, default="normal")
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    instances = relationship("ActivityInstance", back_populates="spec")


class ActivityInstance(Base):
    """One activity node instance per project run. Each node has API; updates DB and triggers next."""
    __tablename__ = "activity_instances"
    id = Column(Integer, primary_key=True, index=True)
    instance_uid = Column(String(64), unique=True, index=True, nullable=False, default=gen_uuid)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    spec_id = Column(Integer, ForeignKey("activity_specs.id"), nullable=False)
    # For group nodes: link to child project or sub-flow
    child_project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    next_instance_ids = Column(JSON, default=list)  # [instance_uid, ...] for edges
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    last_modified = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # pending | in_progress | completed | skipped | cancelled
    status = Column(String(50), nullable=False, default="pending")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    node_type = Column(String(50), nullable=False, default="normal")
    eta_minutes = Column(Float, nullable=True)
    max_eta_minutes = Column(Float, nullable=True)
    payload = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="activity_instances", foreign_keys=[project_id])
    spec = relationship("ActivitySpec", back_populates="instances")
    child_project = relationship("Project", foreign_keys=[child_project_id])
    owner = relationship("User", foreign_keys=[owner_id])


class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="batches")
    tasks = relationship("Task", back_populates="batch", order_by="Task.created_at")


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending | in_progress | completed | skipped
    pipeline_stage = Column(String(50), nullable=False, default="L1")
    content = Column(JSON, nullable=False)
    claimed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    assigned_reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_at = Column(DateTime, nullable=True)
    rework_count = Column(Integer, default=0)  # times sent back by reviewer; efficiency = (total - rework) / total
    draft_response = Column(JSON, default=None)  # auto-save partial annotation before submit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    batch = relationship("Batch", back_populates="tasks")
    claimed_by = relationship("User", foreign_keys=[claimed_by_id])
    assigned_reviewer = relationship("User", foreign_keys=[assigned_reviewer_id])
    annotations = relationship("Annotation", back_populates="task")


class Reference(Base):
    """Static reference data for tasks/activities: unique id, name, api endpoint, description."""
    __tablename__ = "references"
    id = Column(Integer, primary_key=True, index=True)
    ref_type = Column(String(50), nullable=False, index=True)  # task_type, activity_type, status
    unique_id = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    api_endpoint = Column(String(255), default="")
    description = Column(Text, default="")
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Annotation(Base):
    __tablename__ = "annotations"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    response = Column(JSON, nullable=False)
    pipeline_stage = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    task = relationship("Task", back_populates="annotations")


class TaskClaimRequest(Base):
    """Annotator requests to claim a task assigned to someone else. Approved by assignee OR ops/admin."""
    __tablename__ = "task_claim_requests"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(50), nullable=False, default="pending")  # pending | approved | rejected
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", backref="claim_requests")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    current_assignee = relationship("User", foreign_keys=[current_assignee_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
