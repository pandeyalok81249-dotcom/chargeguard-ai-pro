"""Database initialization and schema creation."""

from app.db.database import engine, Base, SessionLocal
from app.db.seed_data import seed_database
from app.core.logging import logger
# Import all models so Base knows about them
import app.models

def init_db():
    """Create tables if they don't exist and seed baseline demo data."""
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized.")

    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
