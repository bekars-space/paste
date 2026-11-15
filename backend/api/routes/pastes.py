from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.core.db import get_db
from api.schemas.paste import PasteCreateResponse, PasteTextCreate
from api.services.paste import create_text_paste

router = APIRouter(prefix="/pastes")


@router.post(
    "",
    response_model=PasteCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_paste(
    payload: PasteTextCreate,
    db: Annotated[Session, Depends(get_db)],
) -> PasteCreateResponse:
    paste = create_text_paste(db, payload)

    return PasteCreateResponse(
        id=paste.id,
        expires_at=paste.expires_at,
    )
