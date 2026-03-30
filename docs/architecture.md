# ClinIQ Architecture

## Frontend
- Next.js App Router
- TailwindCSS for responsive medical UI
- PWA service worker + manifest
- IndexedDB queue for offline intake buffering
- Speech-to-text for hands-free symptom entry

## Backend
- FastAPI modular routers
- SQLModel ORM
- JWT auth and role-based access (`nurse`, `admin`)
- Audit logging for critical actions

## AI Layer
- RandomForest classifier (lightweight and explainable)
- Structured inputs: symptoms + vitals + optional context
- Outputs: triage, risk score, ranked conditions, explainability
- Local model execution for offline-capable deployment designs

## Clinical Workflows
- Intake -> prediction -> visit record -> alert/referral
- Guideline lookup for protocol-aligned care steps
- Simulation mode for nurse training and competency feedback

## Data Model
- Users
- Patients
- Visits
- Referrals
- DrugStock
- AuditLog
