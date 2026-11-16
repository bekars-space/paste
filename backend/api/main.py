from fastapi import FastAPI
from fastapi.routing import APIRouter

from api.core.config import settings

from .routes import health, pastes

app = FastAPI()

api_router = APIRouter(prefix=settings.API_V1_STR)
api_router.include_router(pastes.router)
app.include_router(api_router)
app.include_router(health.router)


@app.get("/")
async def root():
    return {"message": "hello"}
