from fastapi import FastAPI

from .routes import health

api = FastAPI()

api.include_router(health.router, prefix="/api/v1")

@api.get("/")
async def root():
    return {"message": "hello"}
