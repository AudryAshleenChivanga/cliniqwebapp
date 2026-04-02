from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlmodel import Session, select

from .core.config import get_settings
from . import db
from .models.entities import DrugStock, User, UserRole
from .routers import (
    analytics,
    assistant,
    auth,
    doctor_chat,
    drugs,
    encounters,
    patients,
    predict,
    prescriptions,
    records,
    referrals,
    simulation,
    team_chat,
    users,
)
from .security import hash_password

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.create_db_and_tables()
    # Backward-compatible column additions for existing SQLite databases.
    if str(db.engine.url).startswith("sqlite"):
        with db.engine.begin() as conn:
            existing_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(user)")).fetchall()}
            alter_statements = []
            if "department" not in existing_cols:
                alter_statements.append("ALTER TABLE user ADD COLUMN department VARCHAR DEFAULT 'General'")
            if "phone" not in existing_cols:
                alter_statements.append("ALTER TABLE user ADD COLUMN phone VARCHAR")
            if "avatar_url" not in existing_cols:
                alter_statements.append("ALTER TABLE user ADD COLUMN avatar_url VARCHAR")
            if "bio" not in existing_cols:
                alter_statements.append("ALTER TABLE user ADD COLUMN bio VARCHAR")
            for stmt in alter_statements:
                conn.execute(text(stmt))
    with Session(db.engine) as session:
        admin = session.exec(select(User).where(User.email == "admin@cliniq.app")).first()
        if not admin:
            session.add(
                User(
                    full_name="ClinIQ Admin",
                    email="admin@cliniq.app",
                    password_hash=hash_password("Admin123!"),
                    role=UserRole.admin,
                    department="Administration",
                )
            )
        nurse = session.exec(select(User).where(User.email == "nurse@cliniq.app")).first()
        if not nurse:
            session.add(
                User(
                    full_name="ClinIQ Nurse",
                    email="nurse@cliniq.app",
                    password_hash=hash_password("Nurse123!"),
                    role=UserRole.nurse,
                    department="Emergency",
                )
            )
        for name, alt in [("ceftriaxone", "ampicillin"), ("oxygen", "manual airway support"), ("labetalol", "hydralazine")]:
            existing = session.exec(select(DrugStock).where(DrugStock.name == name)).first()
            if not existing:
                session.add(DrugStock(name=name, is_available=True, alternative=alt))
        session.commit()
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "cliniq-backend"}


@app.get("/")
def root():
    return {
        "message": "ClinIQ backend is running",
        "health": "/health",
        "docs": "/docs",
    }


app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(predict.router)
app.include_router(records.router)
app.include_router(referrals.router)
app.include_router(assistant.router)
app.include_router(simulation.router)
app.include_router(analytics.router)
app.include_router(drugs.router)
app.include_router(encounters.router)
app.include_router(doctor_chat.router)
app.include_router(prescriptions.router)
app.include_router(team_chat.router)
app.include_router(users.router)

uploads_path = Path(__file__).resolve().parents[1] / "uploads"
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")
