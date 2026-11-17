from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from api.core.db import get_db
from api.schemas.paste import (
    PasteCreateResponse,
    PasteMetadataResponse,
    PasteTextCreate,
)
from api.services.paste import create_text_paste, get_paste_metadata, get_paste_raw

router = APIRouter(prefix="/pastes")


@router.post(
    "/",
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


@router.get("/{paste_id}", response_model=PasteMetadataResponse)
def read_paste(
    paste_id: UUID, db: Annotated[Session, Depends(get_db)]
) -> PasteMetadataResponse:

    paste = get_paste_metadata(db, paste_id)

    if paste is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="paste not found"
        )

    return PasteMetadataResponse.model_validate(paste)


@router.get("/{paste_id}/raw")
def read_paste_raw(paste_id: UUID, db: Annotated[Session, Depends(get_db)]) -> Response:
    content = get_paste_raw(db, paste_id)

    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="paste not found"
        )

    return Response(
        content,
        media_type="text/plain",
    )
