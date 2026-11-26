import logging
import re
from pathlib import PurePosixPath
from typing import BinaryIO
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from api.core import storage
from api.models import Paste
from api.schemas.paste import PasteTextCreate, PasteType
from api.services.expiration import calculate_expiration

logger = logging.getLogger(__name__)

_MEDIA_TYPE_RE = re.compile(
    r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+/[!#$%&'*+.^_`|~0-9A-Za-z-]+$"
)
_DEFAULT_CONTENT_TYPE = "application/octet-stream"


def create_text_paste(db: Session, payload: PasteTextCreate) -> Paste:
    content = payload.content
    size_bytes = len(content.encode("utf-8"))

    paste = Paste(
        type=PasteType.TEXT.value,
        content=content,
        object_key=None,
        filename=None,
        content_type=None,
        size_bytes=size_bytes,
        expires_at=calculate_expiration(size_bytes),
    )

    db.add(paste)
    db.commit()
    db.refresh(paste)

    return paste


def create_file_paste(
    db: Session,
    fileobj: BinaryIO,
    *,
    filename: str | None,
    content_type: str | None,
    size_bytes: int,
) -> Paste:
    paste_id = uuid4()
    object_key = f"pastes/{paste_id}"
    normalized_filename = _sanitize_filename(filename)
    normalized_content_type = _normalize_content_type(content_type)

    paste = Paste(
        id=paste_id,
        type=PasteType.FILE.value,
        content=None,
        object_key=object_key,
        filename=normalized_filename,
        content_type=normalized_content_type,
        size_bytes=size_bytes,
        expires_at=calculate_expiration(size_bytes),
    )

    storage.put_object(
        object_key,
        fileobj,
        content_type=normalized_content_type,
    )

    try:
        db.add(paste)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        try:
            storage.delete_object(object_key)
        except storage.StorageError:
            logger.exception("failed to clean up orphaned object %s", object_key)
        raise

    db.refresh(paste)

    return paste


def get_paste(db: Session, paste_id: UUID) -> Paste | None:
    statement = select(Paste).where(Paste.id == paste_id, Paste.expires_at > func.now())

    return db.scalar(statement)


def _sanitize_filename(filename: str | None) -> str:
    name = (filename or "file").replace("\\", "/")
    name = PurePosixPath(name).name
    name = "".join(character for character in name if character.isprintable()).strip()

    return (name or "file")[:255]


def _normalize_content_type(content_type: str | None) -> str:
    value = (content_type or "").split(";", 1)[0].strip()

    if not _MEDIA_TYPE_RE.match(value):
        return _DEFAULT_CONTENT_TYPE

    return value[:255]
