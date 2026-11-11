"""Database connection: engine, session factory, model base class."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

# SQLite only allows the thread that opened a connection to use it.
# FastAPI serves requests on several threads, so we switch that check off.
# PostgreSQL doesn't need this.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    """Every table class in models.py inherits from this."""


def get_db():
    """Give one database session to a request, and always close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
