from sqlalchemy import create_engine

from api.core.config import Settings

engine = create_engine(str(Settings.SQL_ALCHEMY_DATABASE_URI))
