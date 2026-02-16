"""
DB tab: list tables with schema/relationships and optionally load table data.
For testing database and data without external tools. Ops/Admin only.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db, engine, Base
from ..auth import get_current_user, require_ops

router = APIRouter(prefix="/db", tags=["db"])

# Whitelist: only expose these table names (from our models)
ALLOWED_TABLES = {
    "users",
    "workspaces",
    "media",
    "projects",
    "user_tagged",
    "activity_specs",
    "activity_instances",
    "batches",
    "tasks",
    "references",
    "annotations",
}
if hasattr(models, "TaskClaimRequest"):
    ALLOWED_TABLES.add("task_claim_requests")


def _get_table_names():
    # Prefer tables that exist in metadata; fallback to all allowed names so list is never empty
    in_metadata = set()
    for t in Base.metadata.sorted_tables:
        try:
            in_metadata.add(str(t.name))
        except Exception:
            pass
    names = [n for n in sorted(ALLOWED_TABLES) if n in in_metadata]
    if not names:
        names = sorted(ALLOWED_TABLES)
    return names


def _get_columns(table_name):
    """Build column list. Use inspector for PK to avoid column.primary_key (can raise 'Boolean value of this clause is not defined')."""
    if table_name not in ALLOWED_TABLES:
        return []
    table = Base.metadata.tables.get(table_name)
    if not table:
        return []
    pk_names = set()
    try:
        insp = inspect(engine)
        pk_info = insp.get_pk_constraint(table_name)
        if pk_info and isinstance(pk_info.get("constrained_columns"), list):
            pk_names = set(pk_info["constrained_columns"])
    except Exception:
        pass
    out = []
    for c in table.columns:
        try:
            out.append({
                "name": str(c.name),
                "type": str(c.type),
                "nullable": True,
                "primary_key": str(c.name) in pk_names,
            })
        except Exception:
            out.append({"name": "?", "type": "?", "nullable": True, "primary_key": False})
    return out


def _get_fk_relations(table_name):
    if table_name not in ALLOWED_TABLES:
        return []
    table = Base.metadata.tables.get(table_name)
    if not table:
        return []
    out = []
    for fk in table.foreign_keys:
        try:
            ref_name = "?"
            ref_col = "?"
            col_obj = getattr(fk, "column", None)
            if col_obj is not None:
                ref_col = str(getattr(col_obj, "name", "?"))
                ref_t = getattr(col_obj, "table", None)
                if ref_t is not None:
                    ref_name = str(getattr(ref_t, "name", "?"))
            parent_name = str(getattr(fk.parent, "name", "?"))
            out.append({"column": parent_name, "references": f"{ref_name}.{ref_col}"})
        except Exception:
            out.append({"column": "?", "references": "?"})
    return out


# Simple relationship map for diagram (table -> list of (ref_table, via_column))
RELATIONSHIP_MAP = {
    "users": [("workspaces", "workspace_id")],
    "workspaces": [("users", "created_by_id")],
    "media": [("projects", "project_id"), ("workspaces", "workspace_id"), ("users", "uploaded_by_id")],
    "projects": [("workspaces", "workspace_id"), ("projects", "parent_id"), ("users", "created_by_id"), ("users", "close_by_id")],
    "user_tagged": [("users", "user_id"), ("workspaces", "workspace_id"), ("projects", "project_id")],
    "activity_specs": [],
    "activity_instances": [("projects", "project_id"), ("activity_specs", "spec_id"), ("projects", "child_project_id"), ("users", "owner_id")],
    "batches": [("projects", "project_id")],
    "tasks": [("batches", "batch_id"), ("users", "claimed_by_id"), ("users", "assigned_reviewer_id")],
    "references": [],
    "annotations": [("tasks", "task_id"), ("users", "user_id")],
}
if "task_claim_requests" in ALLOWED_TABLES:
    RELATIONSHIP_MAP["task_claim_requests"] = [("tasks", "task_id"), ("users", "requested_by_id"), ("users", "current_assignee_id"), ("users", "approved_by_id")]


@router.get("/tables")
def list_tables(
    user: models.User = Depends(require_ops),
):
    """List all allowed table names with schema and relationship info for each. Super Admin, Admin, and Ops Manager can access."""
    try:
        insp = inspect(engine)
        try:
            existing = set(t.lower() for t in insp.get_table_names())
        except Exception:
            existing = set()
        names = _get_table_names()
        if not names:
            names = [n for n in sorted(ALLOWED_TABLES) if n.lower() in existing]
        if not names:
            names = sorted(ALLOWED_TABLES)
        result = []
        for name in names:
            columns = _get_columns(name)
            fks = _get_fk_relations(name)
            relations = RELATIONSHIP_MAP.get(name, [])
            rel_lines = [f"  → {ref_table} ({col})" for ref_table, col in relations] if relations else ["  (no FKs)"]
            result.append({
                "name": name,
                "columns": columns,
                "foreign_keys": fks,
                "relationship_descriptions": rel_lines,
                "relation_list": [{"table": str(t), "column": str(c)} for t, c in relations],
            })
        return {"tables": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB tables listing failed: {e!s}")


@router.get("/tables/{table_name}/data")
def get_table_data(
    table_name: str,
    limit: int = Query(500, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_ops),
):
    """Load rows for a whitelisted table. Returns list of dicts (serializable)."""
    if table_name not in ALLOWED_TABLES:
        raise HTTPException(status_code=404, detail="Table not found or not allowed")
    insp = inspect(engine)
    try:
        db_tables = [t.lower() for t in insp.get_table_names()]
    except Exception:
        db_tables = []
    if table_name.lower() not in db_tables:
        return {"rows": [], "total": 0, "table": table_name}
    try:
        count_result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
        total = count_result or 0
    except Exception:
        total = 0
    order_col = "id"
    try:
        pk = insp.get_pk_constraint(table_name)
        if pk and pk.get("constrained_columns"):
            order_col = pk["constrained_columns"][0]
        else:
            cols = insp.get_columns(table_name)
            if cols:
                order_col = cols[0]["name"]
    except Exception:
        pass
    try:
        safe_order = order_col if order_col in [c["name"] for c in insp.get_columns(table_name)] else "id"
        rows_result = db.execute(
            text(f"SELECT * FROM {table_name} ORDER BY {safe_order} LIMIT :lim OFFSET :off"),
            {"lim": limit, "off": offset},
        )
        keys = rows_result.keys()
        rows = [dict(zip(keys, row)) for row in rows_result.fetchall()]
        # Serialize dates and non-JSON-simple types
        for r in rows:
            for k, v in list(r.items()):
                if hasattr(v, "isoformat"):
                    r[k] = v.isoformat()
                elif hasattr(v, "__dict__") and not isinstance(v, (dict, list, str, int, float, bool, type(None))):
                    r[k] = str(v)
        return {"rows": rows, "total": total, "table": table_name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
