from fastapi import FastAPI

from .routes import health, pastes

api = FastAPI()

api.include_router(health.router, prefix="/api/v1")
api.include_router(pastes.router, prefix="/api/v1")


@api.get("/")
async def root():
    return {"message": "hello"}
