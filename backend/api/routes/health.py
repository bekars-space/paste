from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.core.db import get_db

router = APIRouter(prefix="/health")


@router.get("/")
async def health():
    return {"status": "running"}


@router.get("/db")
async def health_db(db: Annotated[Session, Depends(get_db)]):
    db.execute(text("SELECT 1"))
    return {"db": "connected"}
