"""Database initialization and schema creation."""

from sqlalchemy import text
from app.db.database import engine, Base, SessionLocal
from app.db.seed_data import seed_database
from app.core.logging import logger
# Import all models so Base knows about them
import app.models

def migrate_schema():
    """Ensure newly added columns exist in existing SQLite databases without data loss."""
    with engine.connect() as conn:
        try:
            # 1. Cables migrations
            res = conn.execute(text("PRAGMA table_info(cables)"))
            cable_cols = {row[1] for row in res.fetchall()}
            if cable_cols:
                cols_to_add = [
                    ("rated_voltage_v", "FLOAT"),
                    ("length_m", "FLOAT"),
                    ("serial_number", "VARCHAR(64)"),
                    ("purchase_date", "VARCHAR(32)")
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in cable_cols:
                        conn.execute(text(f"ALTER TABLE cables ADD COLUMN {col_name} {col_type}"))

            # 2. Measurements migrations
            res_m = conn.execute(text("PRAGMA table_info(measurements)"))
            m_cols = {row[1] for row in res_m.fetchall()}
            if m_cols:
                m_to_add = [
                    ("humidity_pct", "FLOAT"),
                    ("voltage_stability", "FLOAT"),
                    ("fault_status", "VARCHAR(64) DEFAULT 'NORMAL'")
                ]
                for col_name, col_type in m_to_add:
                    if col_name not in m_cols:
                        conn.execute(text(f"ALTER TABLE measurements ADD COLUMN {col_name} {col_type}"))

            # 3. Alerts migrations
            res_a = conn.execute(text("PRAGMA table_info(alerts)"))
            a_cols = {row[1] for row in res_a.fetchall()}
            if a_cols:
                a_to_add = [
                    ("device_id", "VARCHAR(64)"),
                    ("category", "VARCHAR(64) DEFAULT 'GENERAL'"),
                    ("recommended_action", "TEXT"),
                    ("resolution_status", "VARCHAR(32) DEFAULT 'active'"),
                    ("resolved_at", "DATETIME")
                ]
                for col_name, col_type in a_to_add:
                    if col_name not in a_cols:
                        conn.execute(text(f"ALTER TABLE alerts ADD COLUMN {col_name} {col_type}"))

            conn.commit()
            logger.info("Database schema migration checked and applied.")
        except Exception as e:
            logger.warning(f"Schema migration notice: {e}")

def init_db():
    """Create tables if they don't exist, migrate schema, and seed baseline demo data."""
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    migrate_schema()
    logger.info("Database schema initialized.")

    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
