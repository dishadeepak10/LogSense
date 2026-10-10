"""App entry point. Run from backend/:  uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (importing registers the tables with Base)
from app.config import CORS_ORIGINS
from app.database import Base, engine
from app.routers import logs


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once at startup: create any tables that don't exist yet.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="LogSense API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(logs.router)


@app.get("/api/health")
def health():
    """Quick check that the server is up."""
    return {"status": "ok"}
