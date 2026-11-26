from functools import lru_cache
from typing import BinaryIO
from urllib.parse import quote

import boto3
from botocore.client import BaseClient
from botocore.client import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

from api.core.config import settings


class StorageError(Exception):
    """Raised when an object storage operation cannot be completed."""


@lru_cache
def get_s3_client() -> BaseClient:
    return boto3.client(
        "s3",
        endpoint_url=_endpoint_url(),
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY.get_secret_value(),
        config=BotoConfig(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )


def put_object(object_key: str, fileobj: BinaryIO, *, content_type: str) -> None:
    try:
        get_s3_client().upload_fileobj(
            fileobj,
            settings.S3_BUCKET,
            object_key,
            ExtraArgs={"ContentType": content_type},
        )
    except (BotoCoreError, ClientError) as exc:
        raise StorageError("failed to upload object") from exc


def delete_object(object_key: str) -> None:
    try:
        get_s3_client().delete_object(Bucket=settings.S3_BUCKET, Key=object_key)
    except (BotoCoreError, ClientError) as exc:
        raise StorageError("failed to delete object") from exc


def generate_download_url(
    object_key: str,
    *,
    filename: str,
    content_type: str,
    expires_in: int,
) -> str:
    params = {
        "Bucket": settings.S3_BUCKET,
        "Key": object_key,
        "ResponseContentType": content_type,
        "ResponseContentDisposition": _content_disposition(filename),
    }

    try:
        return get_s3_client().generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=max(1, expires_in),
        )
    except (BotoCoreError, ClientError) as exc:
        raise StorageError("failed to generate download URL") from exc


def _endpoint_url() -> str:
    """Return the endpoint with a scheme, as boto3 requires one."""
    endpoint = settings.S3_ENDPOINT_URL.rstrip("/")

    if "://" not in endpoint:
        return f"https://{endpoint}"

    return endpoint


def _content_disposition(filename: str) -> str:
    ascii_filename = filename.encode("ascii", "ignore").decode("ascii") or "download"
    ascii_filename = ascii_filename.replace("\\", "_").replace('"', "_")
    encoded_filename = quote(filename, safe="")

    return (
        f'attachment; filename="{ascii_filename}"; '
        f"filename*=UTF-8''{encoded_filename}"
    )
