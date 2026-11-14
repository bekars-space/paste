from sqlalchemy import create_engine

from api.core.config import settings

engine = create_engine(str(settings.SQL_ALCHEMY_DATABASE_URI))
