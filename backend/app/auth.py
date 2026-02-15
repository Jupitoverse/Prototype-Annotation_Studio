from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from . import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

ROLES_OPS = ("super_admin", "admin", "ops_manager")
ROLES_ANNOTATOR = ("annotator", "ops_manager", "admin", "super_admin")
ROLES_REVIEWER = ("reviewer", "ops_manager", "admin", "super_admin")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_super_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin required")
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin or Super Admin required")
    return user


def require_ops(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role not in ROLES_OPS:
        raise HTTPException(status_code=403, detail="Operation Manager (or Admin) required")
    return user


def require_annotator(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role not in ROLES_ANNOTATOR:
        raise HTTPException(status_code=403, detail="Annotator access required")
    return user


def require_reviewer(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role not in ROLES_REVIEWER:
        raise HTTPException(status_code=403, detail="Reviewer access required")
    return user
