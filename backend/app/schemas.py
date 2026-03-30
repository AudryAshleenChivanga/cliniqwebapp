from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from .models.entities import ReferralStatus, TriageLevel, UserRole


class MessageResponse(BaseModel):
    message: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: UserRole = UserRole.nurse

    @field_validator("password")
    @classmethod
    def validate_strong_password(cls, value: str) -> str:
        checks = [
            len(value) >= 8,
            re.search(r"[A-Z]", value) is not None,
            re.search(r"[a-z]", value) is not None,
            re.search(r"[0-9]", value) is not None,
            re.search(r"[^A-Za-z0-9]", value) is not None,
        ]
        if not all(checks):
            raise ValueError(
                "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol."
            )
        return value


class UserRead(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    department: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PatientCreate(BaseModel):
    national_id: str
    full_name: str
    age: int
    sex: str
    contact: Optional[str] = None
    medical_history: str = ""
    department: str = "OPD"


class PatientRead(PatientCreate):
    id: int
    latest_triage: TriageLevel
    created_at: datetime


class VisitCreate(BaseModel):
    patient_id: int
    symptoms: str
    temperature: float
    systolic_bp: int
    diastolic_bp: int
    heart_rate: int
    oxygen_saturation: Optional[float] = 98


class PredictionInput(BaseModel):
    symptoms: str
    temperature: float
    systolic_bp: int
    diastolic_bp: int
    heart_rate: int
    oxygen_saturation: Optional[float] = 98
    medical_history: str = ""
    available_drugs: list[str] = []


class PredictionOutput(BaseModel):
    top_conditions: list[dict[str, Any]]
    risk_score: float
    triage: TriageLevel
    recommended_next_steps: list[str]
    advisor_summary: str
    emergency_alert: bool
    explainability: dict[str, float]
    referral_recommended: bool
    guideline_references: list[dict[str, str]]


class VisitRead(BaseModel):
    id: int
    patient_id: int
    symptoms: str
    temperature: float
    systolic_bp: int
    diastolic_bp: int
    heart_rate: int
    oxygen_saturation: Optional[float]
    diagnosis: str
    risk_score: float
    triage: TriageLevel
    treatment_plan: str
    emergency_alert: bool
    created_by: int
    created_at: datetime


class ReferralCreate(BaseModel):
    patient_id: int
    reason: str
    target_facility: str


class ReferralRead(BaseModel):
    id: int
    patient_id: int
    reason: str
    note: str
    status: ReferralStatus
    target_facility: str
    created_by: int
    created_at: datetime


class ReferralUpdate(BaseModel):
    status: ReferralStatus


class GuidelineQuery(BaseModel):
    condition: str


class GuidelineResponse(BaseModel):
    condition: str
    steps: list[str]


class ChatRequest(BaseModel):
    prompt: str
    patient_context: Optional[dict[str, Any]] = None


class ChatResponse(BaseModel):
    answer: str


class TeamChatCreate(BaseModel):
    message: str


class TeamChatRead(BaseModel):
    id: int
    sender_user_id: int
    sender_name: str
    sender_role: str
    sender_avatar_url: Optional[str] = None
    message: str
    created_at: datetime


class SimulationCase(BaseModel):
    case_id: int
    title: str
    prompt: str
    expected_triage: TriageLevel


class SimulationAttempt(BaseModel):
    case_id: int
    chosen_triage: TriageLevel


class SimulationResult(BaseModel):
    score: int
    feedback: str


class DrugStockCreate(BaseModel):
    name: str
    is_available: bool = True
    alternative: Optional[str] = None


class DrugStockRead(DrugStockCreate):
    id: int


class VitalsInput(BaseModel):
    temperature: float
    systolic_bp: int
    diastolic_bp: int
    heart_rate: int
    oxygen_saturation: float = 98


class LabsInput(BaseModel):
    wbc: Optional[float] = None
    lactate: Optional[float] = None
    hemoglobin: Optional[float] = None
    platelets: Optional[float] = None
    glucose: Optional[float] = None
    crp: Optional[float] = None


class PatientDemographicsInput(BaseModel):
    national_id: str
    full_name: str
    age: int
    sex: str
    contact: Optional[str] = None


class EncounterWorkflowInput(BaseModel):
    demographics: PatientDemographicsInput
    medical_history: str = ""
    symptoms: str
    vitals: VitalsInput
    labs: LabsInput = LabsInput()
    target_facility: str = "District Hospital"
    call_ambulance_if_critical: bool = True


class EncounterReportRead(BaseModel):
    id: int
    patient_id: int
    report_text: str
    escalated_to_doctor: bool
    referral_issued: bool
    referral_id: Optional[int] = None
    ambulance_called: bool
    ambulance_eta_minutes: Optional[int] = None
    created_at: datetime


class EncounterWorkflowOutput(BaseModel):
    encounter_id: int
    patient_id: int
    prelab_assessment: PredictionOutput
    postlab_assessment: PredictionOutput
    report: EncounterReportRead
    ambulance_message: Optional[str] = None


class DoctorChatCreate(BaseModel):
    encounter_id: int
    sender_role: str
    sender_name: str
    message: str


class DoctorChatRead(BaseModel):
    id: int
    encounter_id: int
    sender_role: str
    sender_name: str
    message: str
    created_at: datetime


class PrescriptionCreate(BaseModel):
    patient_id: int
    encounter_id: Optional[int] = None
    diagnosis: str
    medications: str
    instructions: str
    insurer_name: Optional[str] = None
    policy_number: Optional[str] = None
    clinician_name: str
    electronic_signature: str


class PrescriptionRead(BaseModel):
    id: int
    patient_id: int
    encounter_id: Optional[int] = None
    diagnosis: str
    medications: str
    instructions: str
    insurer_name: Optional[str] = None
    policy_number: Optional[str] = None
    clinician_name: str
    electronic_signature: str
    created_at: datetime
