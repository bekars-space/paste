"""fix valid_payload and add valid_size check constraints

Revision ID: 0b86e423d30d
Revises: e96ebc8d3287
Create Date: 2026-11-15 22:16:20.529991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0b86e423d30d'
down_revision: Union[str, Sequence[str], None] = 'e96ebc8d3287'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Replace the stale valid_payload constraint so that text pastes are
    # allowed to have a non-NULL size_bytes (matches api/models.py).
    op.drop_constraint("valid_payload", "pastes", type_="check")
    op.create_check_constraint(
        "valid_payload",
        "pastes",
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
    )
    # Add the valid_size check constraint that exists on the model but was
    # never applied to the database.
    op.create_check_constraint("valid_size", "pastes", "size_bytes >= 0")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("valid_size", "pastes", type_="check")
    op.drop_constraint("valid_payload", "pastes", type_="check")
    op.create_check_constraint(
        "valid_payload",
        "pastes",
        """
        (
            type = 'text'
            AND content IS NOT NULL
            AND object_key IS NULL
            AND filename IS NULL
            AND content_type IS NULL
            AND size_bytes IS NULL
        )
        OR
        (
            type = 'file'
            AND content IS NULL
            AND object_key IS NOT NULL
            AND filename IS NOT NULL
            AND content_type IS NOT NULL
            AND size_bytes IS NOT NULL
            AND size_bytes >= 0
        )
        """,
    )
