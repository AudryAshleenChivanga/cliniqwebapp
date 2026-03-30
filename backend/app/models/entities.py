from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    nurse = "nurse"
    admin = "admin"


class TriageLevel(str, Enum):
    low = "low"
    medium = "medium"
    critical = "critical"


class ReferralStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    completed = "completed"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str
    email: str = Field(index=True, unique=True)
    password_hash: str
    role: UserRole = Field(default=UserRole.nurse)
    department: str = "General"
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Patient(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    national_id: str = Field(index=True, unique=True)
    full_name: str = Field(index=True)
    age: int
    sex: str
    contact: Optional[str] = None
    medical_history: str = ""
    latest_triage: TriageLevel = Field(default=TriageLevel.low)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PatientDepartmentAssignment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(index=True)
    department: str = Field(index=True)
    assigned_by: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Visit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(index=True)
    symptoms: str
    temperature: float
    systolic_bp: int
    diastolic_bp: int
    heart_rate: int
    oxygen_saturation: Optional[float] = 98.0
    diagnosis: str
    risk_score: float
    triage: TriageLevel
    treatment_plan: str
    emergency_alert: bool = False
    created_by: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Referral(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(index=True)
    reason: str
    note: str
    status: ReferralStatus = Field(default=ReferralStatus.pending)
    target_facility: str
    created_by: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EncounterReport(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(index=True)
    symptoms: str
    vitals_json: str
    labs_json: str = "{}"
    prelab_summary_json: str
    postlab_summary_json: str
    report_text: str
    escalated_to_doctor: bool = False
    referral_issued: bool = False
    referral_id: Optional[int] = None
    ambulance_called: bool = False
    ambulance_eta_minutes: Optional[int] = None
    created_by: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DoctorChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    encounter_id: int = Field(index=True)
    sender_role: str
    sender_name: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TeamChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sender_user_id: int = Field(index=True)
    sender_name: str
    sender_role: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Prescription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(index=True)
    encounter_id: Optional[int] = Field(default=None, index=True)
    diagnosis: str
    medications: str
    instructions: str
    insurer_name: Optional[str] = None
    policy_number: Optional[str] = None
    clinician_name: str
    electronic_signature: str
    created_by: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DrugStock(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    is_available: bool = True
    alternative: Optional[str] = None


class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    actor_user_id: int
    action: str
    metadata_json: str = "{}"
    created_at: datetime = Field(default_factory=datetime.utcnow)
