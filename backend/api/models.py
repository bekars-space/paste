import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Index, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql.sqltypes import BigInteger, DateTime, String, Text


class Base(DeclarativeBase):
    pass


class Paste(Base):
    __tablename__ = "pastes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )

    type: Mapped[str] = mapped_column(String(10), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    object_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "type IN ('text', 'file')",
            name="valid_paste_type",
        ),
        CheckConstraint(
            """
            (
                type = 'text'
                AND content IS NOT NULL
                AND object_key IS NULL
                AND filename IS NULL
                AND content_type IS NULL
            )
            OR
            (
                type = 'file'
                AND content IS NULL
                AND object_key IS NOT NULL
                AND filename IS NOT NULL
                AND content_type IS NOT NULL
            )
            """,
            name="valid_payload",
        ),
        CheckConstraint(
            "expires_at > created_at",
            name="valid_expiration",
        ),
        CheckConstraint(
            "size_bytes >= 0",
            name="valid_size",
        ),
        Index("ix_pastes_expires_at", "expires_at"),
    )
