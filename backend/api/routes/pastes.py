import os
from datetime import UTC, datetime
from typing import Annotated, BinaryIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile as StarletteUploadFile
from starlette.formparsers import MultiPartException

from api.core import storage
from api.core.config import settings
from api.core.db import get_db
from api.models import Paste
from api.schemas.paste import (
    PasteCreateResponse,
    PasteMetadataResponse,
    PasteTextCreate,
    PasteType,
)
from api.services.paste import create_file_paste, create_text_paste, get_paste

router = APIRouter(prefix="/pastes")

# Multipart framing (boundaries, part headers) adds a little on top of the
# file itself, so allow some slack when checking Content-Length up front.
_MULTIPART_OVERHEAD_BYTES = 64 * 1024


@router.post(
    "/",
    response_model=PasteCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_paste(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> PasteCreateResponse:
    media_type = (
        request.headers.get("content-type", "").partition(";")[0].strip().lower()
    )

    if media_type == "text/plain":
        paste = await _create_text_paste(request, db)
    elif media_type == "multipart/form-data":
        paste = await _create_file_paste(request, db)
    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="use text/plain or multipart/form-data",
        )

    return PasteCreateResponse(
        id=paste.id,
        expires_at=paste.expires_at,
    )


@router.get("/{paste_id}", response_model=PasteMetadataResponse)
def read_paste(
    paste_id: UUID, db: Annotated[Session, Depends(get_db)]
) -> PasteMetadataResponse:
    paste = get_paste(db, paste_id)

    if paste is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="paste not found"
        )

    return PasteMetadataResponse.model_validate(paste)


@router.get("/{paste_id}/raw")
def read_paste_raw(paste_id: UUID, db: Annotated[Session, Depends(get_db)]) -> Response:
    paste = get_paste(db, paste_id)

    if paste is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="paste not found"
        )

    if paste.type == PasteType.TEXT.value:
        return Response(
            paste.content or "",
            media_type="text/plain",
        )

    if paste.object_key is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="paste is missing its object key",
        )

    try:
        download_url = storage.generate_download_url(
            paste.object_key,
            filename=paste.filename or "download",
            content_type=paste.content_type or "application/octet-stream",
            expires_in=_download_url_ttl(paste.expires_at),
        )
    except storage.StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="object storage unavailable",
        ) from exc

    return RedirectResponse(
        download_url,
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )


async def _create_text_paste(request: Request, db: Session) -> Paste:
    _reject_if_declared_too_large(request, settings.MAX_TEXT_SIZE_BYTES)

    body = await request.body()

    if len(body) > settings.MAX_TEXT_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="text paste too large",
        )

    try:
        payload = PasteTextCreate(content=body.decode("utf-8"))
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="body must be valid UTF-8",
        ) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="content must not be empty",
        ) from exc

    return await run_in_threadpool(create_text_paste, db, payload)


async def _create_file_paste(request: Request, db: Session) -> Paste:
    _reject_if_declared_too_large(
        request,
        settings.MAX_SIZE_BYTES + _MULTIPART_OVERHEAD_BYTES,
    )

    try:
        form = await request.form()
    except MultiPartException as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="malformed multipart body",
        ) from exc

    try:
        upload = form.get("file")

        if not isinstance(upload, StarletteUploadFile):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="expected a 'file' form field",
            )

        size_bytes = _file_size(upload.file)

        if size_bytes > settings.MAX_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="file too large",
            )

        try:
            return await run_in_threadpool(
                create_file_paste,
                db,
                upload.file,
                filename=upload.filename,
                content_type=upload.content_type,
                size_bytes=size_bytes,
            )
        except storage.StorageError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="object storage unavailable",
            ) from exc
    finally:
        await form.close()


def _reject_if_declared_too_large(request: Request, limit: int) -> None:
    declared_length = _declared_content_length(request)

    if declared_length is not None and declared_length > limit:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="payload too large",
        )


def _declared_content_length(request: Request) -> int | None:
    raw_length = request.headers.get("content-length")

    if raw_length is None:
        return None

    try:
        return int(raw_length)
    except ValueError:
        return None


def _file_size(fileobj: BinaryIO) -> int:
    fileobj.seek(0, os.SEEK_END)
    size = fileobj.tell()
    fileobj.seek(0)

    return size


def _download_url_ttl(expires_at: datetime) -> int:
    remaining_seconds = int((expires_at - datetime.now(UTC)).total_seconds())

    return max(1, min(remaining_seconds, settings.PRESIGNED_URL_EXPIRY_SECONDS))
