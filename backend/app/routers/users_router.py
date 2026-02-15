import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_ops
from ..auth import get_password_hash

router = APIRouter(prefix="/users", tags=["users"])

# Roles that can access User Management (Super Admin, Admin, Ops Manager)
OPS_ROLES = ("super_admin", "admin", "ops_manager")


def generate_next_user_id(db: Session) -> str:
    """Generate unique userid e.g. u1, u2, u3."""
    max_num = 0
    for col in (models.User.userid, models.User.external_id):
        try:
            rows = db.query(col).filter(col.isnot(None)).all()
            for (val,) in rows:
                if val and isinstance(val, str):
                    m = re.match(r"u(\d+)$", val.strip().lower())
                    if m:
                        max_num = max(max_num, int(m.group(1)))
        except Exception:
            pass
    return f"u{max_num + 1}"


def _full_name(first: str, middle: str, last: str) -> str:
    return " ".join(x for x in (first or "", middle or "", last or "") if x).strip()


def _ensure_workspace_ids(val):
    if val is None:
        return []
    if isinstance(val, list):
        return [int(x) for x in val if x is not None]
    return []


@router.get("", response_model=list[schemas.UserResponse])
def list_users(
    role: str | None = Query(None, description="Filter by role"),
    workspace_id: int | None = Query(None, description="Filter by workspace access"),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    """List users. Only Super Admin, Admin, Ops Manager. Filters: role, workspace_id (user has access)."""
    q = db.query(models.User)
    if role:
        q = q.filter(models.User.role == role)
    users = q.order_by(models.User.created_at).all()
    if workspace_id is not None:
        out = []
        for u in users:
            ids = u.workspace_ids if hasattr(u, "workspace_ids") and u.workspace_ids is not None else []
            if not isinstance(ids, list):
                ids = [ids] if ids is not None else []
            if workspace_id in ids:
                out.append(u)
        return out
    return users


@router.get("/me", response_model=schemas.UserResponse)
def get_me(user: models.User = Depends(get_current_user)):
    """Current logged-in user."""
    return user


@router.get("/by-role", response_model=list[schemas.UserResponse])
def list_users_by_role(
    role: str = Query(..., description="annotator or reviewer"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List users by role (e.g. for dropdowns)."""
    if role not in ("annotator", "reviewer", "ops_manager", "admin", "super_admin", "guest", "support_person"):
        raise HTTPException(status_code=400, detail="Invalid role")
    return db.query(models.User).filter(
        models.User.role == role,
        models.User.is_active == True,
    ).order_by(models.User.first_name, models.User.last_name).all()


@router.get("/roles", response_model=list[dict])
def list_roles(_: models.User = Depends(require_ops)):
    """Return role options for User Management."""
    return [
        {"id": "super_admin", "label": "Super Admin"},
        {"id": "admin", "label": "Admin"},
        {"id": "ops_manager", "label": "Operation Manager"},
        {"id": "annotator", "label": "Annotator"},
        {"id": "reviewer", "label": "Reviewer"},
        {"id": "guest", "label": "Guest"},
        {"id": "support_person", "label": "Support Person"},
    ]


# Dummy users for seed (20+ users, all roles): (email, password, display_name, role)
DUMMY_SEED_USERS = [
    ("abhi@annotationstudio.com", "admin123", "Abhi", "super_admin"),
    ("admin@annotationstudio.com", "admin123", "Admin", "super_admin"),
    ("yudhishthira@annotationstudio.com", "admin123", "Yudhishthira", "admin"),
    ("admin2@annotationstudio.com", "admin123", "Admin Two", "admin"),
    ("bhima@annotationstudio.com", "admin123", "Bhima", "ops_manager"),
    ("ops@annotationstudio.com", "admin123", "Ops Manager", "ops_manager"),
    ("annotator1@annotationstudio.com", "demo123", "Annotator One", "annotator"),
    ("annotator2@annotationstudio.com", "demo123", "Annotator Two", "annotator"),
    ("annotator3@annotationstudio.com", "demo123", "Annotator Three", "annotator"),
    ("annotator4@annotationstudio.com", "demo123", "Annotator Four", "annotator"),
    ("annotator5@annotationstudio.com", "demo123", "Annotator Five", "annotator"),
    ("reviewer1@annotationstudio.com", "demo123", "Reviewer One", "reviewer"),
    ("reviewer2@annotationstudio.com", "demo123", "Reviewer Two", "reviewer"),
    ("reviewer3@annotationstudio.com", "demo123", "Reviewer Three", "reviewer"),
    ("reviewer4@annotationstudio.com", "demo123", "Reviewer Four", "reviewer"),
    ("reviewer5@annotationstudio.com", "demo123", "Reviewer Five", "reviewer"),
    ("guest@annotationstudio.com", "guest123", "Guest User", "guest"),
    ("guest2@annotationstudio.com", "guest123", "Guest Two", "guest"),
    ("support1@annotationstudio.com", "support123", "Support One", "support_person"),
    ("support2@annotationstudio.com", "support123", "Support Two", "support_person"),
]


def _assign_userids(db: Session):
    """Assign userid u1, u2, ... to any user missing one."""
    users = db.query(models.User).order_by(models.User.id).all()
    for i, u in enumerate(users, 1):
        uid = f"u{i}"
        if getattr(u, "userid", None) != uid:
            u.userid = uid
            u.external_id = uid
        if getattr(u, "availability", None) is None:
            u.availability = "100%"
        if getattr(u, "max_load", None) is None:
            u.max_load = 50
    db.commit()


@router.post("/seed-dummy", response_model=dict)
def seed_dummy_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_ops),
):
    """Create 20+ dummy users (all roles) if they don't exist. Safe to call multiple times."""
    created = 0
    for email, password, full_name, role in DUMMY_SEED_USERS:
        if db.query(models.User).filter(models.User.email == email).first():
            continue
        new_userid = generate_next_user_id(db)
        u = models.User(
            email=email,
            hashed_password=get_password_hash(password),
            first_name=full_name or "",
            last_name="",
            full_name=full_name or "",
            role=role,
            availability="100%",
            max_load=50,
            userid=new_userid,
            external_id=new_userid,
        )
        db.add(u)
        created += 1
    db.commit()
    _assign_userids(db)
    return {"created": created, "message": f"Created {created} dummy user(s). All users have userids assigned."}


@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Get user by id. Ops can get any; others only self."""
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if current.role not in OPS_ROLES and u.id != current.id:
        raise HTTPException(status_code=403, detail="Not allowed to view this user")
    return u


@router.post("", response_model=schemas.UserResponse)
def create_user(
    body: schemas.UserCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    """Create user. Only Super Admin, Admin, Ops Manager. User ID is auto-generated."""
    if body.role not in schemas.USER_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Allowed: {schemas.USER_ROLES}")
    existing = db.query(models.User).filter(models.User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_userid = generate_next_user_id(db)
    full = _full_name(body.first_name, body.middle_name, body.last_name)
    workspace_ids = _ensure_workspace_ids(body.workspace_ids)
    u = models.User(
        email=body.email,
        hashed_password=get_password_hash(body.password),
        first_name=body.first_name or "",
        middle_name=body.middle_name or "",
        last_name=body.last_name or "",
        full_name=full,
        role=body.role,
        mobile=body.mobile,
        company_id=body.company_id,
        workspace_ids=workspace_ids,
        userid=new_userid,
        external_id=new_userid,
        availability=getattr(body, "availability", None) or "100%",
        max_load=getattr(body, "max_load", None) or 50,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.patch("/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    body: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Update user. Ops: any field (except external_id). Others: only self, only name/company."""
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if current.role in OPS_ROLES:
        for k, v in body.model_dump(exclude_unset=True).items():
            if k == "password":
                if v and v.strip():
                    u.hashed_password = get_password_hash(v)
            elif k == "first_name" or k == "middle_name" or k == "last_name":
                setattr(u, k, v or "")
            elif k == "workspace_ids":
                setattr(u, k, _ensure_workspace_ids(v))
            elif k == "role" and v and v not in schemas.USER_ROLES:
                continue
            else:
                setattr(u, k, v)
        if body.first_name is not None or body.middle_name is not None or body.last_name is not None:
            u.full_name = _full_name(
                getattr(u, "first_name", "") or "",
                getattr(u, "middle_name", "") or "",
                getattr(u, "last_name", "") or "",
            )
    else:
        if u.id != current.id:
            raise HTTPException(status_code=403, detail="Not allowed to edit this user")
        if body.first_name is not None:
            u.first_name = body.first_name
        if body.middle_name is not None:
            u.middle_name = body.middle_name
        if body.last_name is not None:
            u.last_name = body.last_name
        if body.company_id is not None:
            u.company_id = body.company_id
        u.full_name = _full_name(u.first_name or "", u.middle_name or "", u.last_name or "")
    db.commit()
    db.refresh(u)
    return u
