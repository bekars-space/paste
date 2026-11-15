import math
from datetime import UTC, datetime, timedelta

from api.core.config import settings


def calculate_expiration(size_bytes: int) -> datetime:
    size_mib = size_bytes / (1024 * 1024)

    expiration_days = max(
        settings.MIN_EXPIRATION_DAYS,
        settings.MAX_EXPIRATION_DAYS
        - settings.EXPIRATION_COEFFICIENT * math.log2(1 + size_mib),
    )

    return datetime.now(UTC) + timedelta(days=expiration_days)
