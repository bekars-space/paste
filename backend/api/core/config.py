from pydantic import PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",  # Use top level .env file
        env_ignore_empty=True,
        extra="ignore",
    )
    API_V1_STR: str = "/api/v1"

    POSTGRES_SERVER: str
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = ""

    @property
    def SQL_ALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        return PostgresDsn.build(
            scheme="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    MAX_EXPIRATION_DAYS: int = 30
    MIN_EXPIRATION_DAYS: int = 1
    MAX_SIZE_BYTES: int = 128 * 1024 * 1024
    MAX_TEXT_SIZE_BYTES: int = 1024 * 1024
    EXPIRATION_COEFFICIENT: int = 4
    PRESIGNED_URL_EXPIRY_SECONDS: int = 15 * 60

    S3_ENDPOINT_URL: str
    S3_REGION: str = "us-east-2"
    S3_ACCESS_KEY_ID: str
    S3_SECRET_ACCESS_KEY: SecretStr
    S3_BUCKET: str


settings = Settings()  # type: ignore
