from pydantic import BaseModel, field_validator
from typing import Optional, List, Any
from datetime import datetime
import json


# Roles allowed in User Management
USER_ROLES = ("super_admin", "admin", "ops_manager", "annotator", "reviewer", "guest", "support_person")


class UserBase(BaseModel):
    email: str
    first_name: Optional[str] = ""
    middle_name: Optional[str] = ""
    last_name: Optional[str] = ""
    full_name: Optional[str] = ""
    role: str
    mobile: Optional[str] = None
    company_id: Optional[str] = None
    workspace_id: Optional[int] = None
    workspace_ids: Optional[List[int]] = None


class UserCreate(BaseModel):
    first_name: str
    email: str
    password: str
    middle_name: Optional[str] = ""
    last_name: Optional[str] = ""
    role: str
    availability: Optional[str] = "100%"  # 100%, 50%, 25%, 75%
    max_load: Optional[int] = 50
    mobile: Optional[str] = None
    company_id: Optional[str] = None
    workspace_ids: Optional[List[int]] = []

    @field_validator("first_name", "password")
    @classmethod
    def required_not_empty(cls, v: str) -> str:
        if v is None or not str(v).strip():
            raise ValueError("This field is required")
        return str(v).strip()

    @field_validator("email")
    @classmethod
    def email_required_and_format(cls, v: str) -> str:
        if v is None or not str(v).strip():
            raise ValueError("Email is required")
        v = str(v).strip()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return v


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    availability: Optional[str] = None
    max_load: Optional[int] = None
    mobile: Optional[str] = None
    company_id: Optional[str] = None
    workspace_id: Optional[int] = None
    workspace_ids: Optional[List[int]] = None
    is_active: Optional[bool] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    userid: Optional[str] = None
    external_id: Optional[str] = None
    email: str
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    availability: Optional[str] = None
    max_load: Optional[int] = None
    mobile: Optional[str] = None
    company_id: Optional[str] = None
    workspace_id: Optional[int] = None
    workspace_ids: Optional[List[int]] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("workspace_ids", mode="before")
    @classmethod
    def coerce_workspace_ids(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            return [int(x) for x in v if x is not None]
        if isinstance(v, str):
            try:
                return json.loads(v) if v.strip() else []
            except Exception:
                return []
        return []

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class WorkspaceBase(BaseModel):
    name: str
    description: Optional[str] = ""


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceResponse(WorkspaceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = ""
    external_id: Optional[str] = None
    profile_type: str = "parent"
    pipeline_template: Optional[str] = None
    pipeline_stages: List[str] = ["L1", "Review", "Done"]
    response_schema: Optional[dict] = None
    status: Optional[str] = "draft"
    annotator_ids: Optional[List[int]] = None
    reviewer_ids: Optional[List[int]] = None
    annotator_pct: Optional[List[float]] = None
    reviewer_pct: Optional[List[float]] = None
    annotator_eta_days: Optional[List[Optional[float]]] = None  # working days or null per assignee
    reviewer_eta_days: Optional[List[Optional[float]]] = None
    num_annotators: Optional[int] = None
    num_reviewers: Optional[int] = None


class ProjectCreate(ProjectBase):
    workspace_id: int
    parent_id: Optional[int] = None


class ProjectResponse(ProjectBase):
    id: int
    workspace_id: int
    parent_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MediaResponse(BaseModel):
    id: int
    project_id: int
    workspace_id: int
    file_type: Optional[str] = None
    file_name: Optional[str] = None
    size_bytes: Optional[int] = 0
    uploaded_by_id: Optional[int] = None
    created_at: datetime
    external_id: Optional[str] = None

    class Config:
        from_attributes = True


class MyAssignmentResponse(BaseModel):
    """One assignment for current user: project + role + percent + ETA."""
    project_id: int
    project_name: str
    external_id: Optional[str] = None
    workspace_id: int
    role: str  # annotator | reviewer
    percent: float
    eta_days: Optional[float] = None
    status: Optional[str] = None


class ActivitySpecBase(BaseModel):
    spec_id: str
    name: str
    description: Optional[str] = ""
    api_endpoint: Optional[str] = ""
    node_type: str = "normal"
    config: Optional[dict] = None


class ActivitySpecCreate(ActivitySpecBase):
    pass


class ActivitySpecResponse(ActivitySpecBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActivityInstanceBase(BaseModel):
    spec_id: int
    child_project_id: Optional[int] = None
    next_instance_ids: List[str] = []
    node_type: str = "normal"
    eta_minutes: Optional[float] = None
    max_eta_minutes: Optional[float] = None
    payload: Optional[dict] = None


class ActivityInstanceCreate(ActivityInstanceBase):
    project_id: int


class ActivityInstanceResponse(BaseModel):
    id: int
    instance_uid: str
    project_id: int
    spec_id: int
    child_project_id: Optional[int] = None
    next_instance_ids: List[str] = []
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    last_modified: Optional[datetime] = None
    status: str
    owner_id: Optional[int] = None
    node_type: str
    eta_minutes: Optional[float] = None
    max_eta_minutes: Optional[float] = None
    payload: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    spec: Optional[ActivitySpecResponse] = None

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    name: str


class BatchCreate(BatchBase):
    project_id: int


class BatchResponse(BatchBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    pipeline_stage: Optional[str] = "L1"
    content: Optional[dict] = None


class TaskCreate(TaskBase):
    batch_id: int


class TaskResponse(BaseModel):
    id: int
    batch_id: int
    status: str
    pipeline_stage: str
    content: dict
    claimed_by_id: Optional[int] = None
    claimed_at: Optional[datetime] = None
    assigned_reviewer_id: Optional[int] = None
    due_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    age_days: Optional[float] = None  # elapsed days since claimed_at or created_at
    remaining_days: Optional[float] = None  # days left until due_at (negative if overdue)

    class Config:
        from_attributes = True


class TaskUpdate(BaseModel):
    claimed_by_id: Optional[int] = None
    assigned_reviewer_id: Optional[int] = None
    status: Optional[str] = None
    pipeline_stage: Optional[str] = None
    due_at: Optional[datetime] = None


class AnnotationBase(BaseModel):
    response: dict
    pipeline_stage: str


class AnnotationCreate(AnnotationBase):
    task_id: int


class AnnotationResponse(AnnotationBase):
    id: int
    task_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NodeTriggerRequest(BaseModel):
    """Request body for node API: from previous node or admin panel."""
    payload: Optional[dict] = None
    trigger_by_user_id: Optional[int] = None


class TaskBulkCreate(BaseModel):
    batch_id: int
    items: List[dict]
