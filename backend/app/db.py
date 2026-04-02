import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, SQLModel, create_engine
from .core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _create_db_engine(url: str):
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, echo=False, connect_args=connect_args)


engine = _create_db_engine(settings.database_url)
_active_database_url = settings.database_url
_engine_checked = False


def _ensure_database_engine() -> None:
    global engine, _active_database_url, _engine_checked
    if _engine_checked:
        return

    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
    except SQLAlchemyError:
        should_fallback = settings.database_fallback_enabled and _active_database_url != settings.database_fallback_url
        if not should_fallback:
            raise

        fallback_url = settings.database_fallback_url
        logger.warning(
            "Primary database unavailable (%s). Falling back to %s",
            _active_database_url,
            fallback_url,
        )
        fallback_engine = _create_db_engine(fallback_url)
        with fallback_engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        engine = fallback_engine
        _active_database_url = fallback_url
        logger.warning("Database fallback active. Using %s", _active_database_url)
    finally:
        _engine_checked = True


def create_db_and_tables() -> None:
    _ensure_database_engine()
    SQLModel.metadata.create_all(engine)


def get_session():
    _ensure_database_engine()
    with Session(engine) as session:
        yield session
