from sqlalchemy.orm import Session

from api.models import Paste
from api.schemas.paste import PasteTextCreate, PasteType
from api.services.expiration import calculate_expiration


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
