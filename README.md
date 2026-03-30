# ClinIQ

ClinIQ is a production-ready AI-powered clinical decision support platform for frontline healthcare workers in low-resource settings.

## Monorepo Structure

- `frontend/` - Next.js + Tailwind medical UI + PWA offline capabilities
- `backend/` - FastAPI, JWT authentication, EMR, triage APIs, analytics, referrals
- `ai-model/` - Lightweight explainable RandomForest clinical model
- `docs/` - Deployment and architecture docs

## Core Capabilities Implemented

- Patient registration with demographics + department-tracking ID
- AI clinical prediction (conditions, confidence, risk score, triage, advisor summary)
- Smart triage alerts (visual flashing + sound)
- Lightweight EMR timeline, encounter reports, and visit records
- Referral generation and status tracking
- Offline-first queue with sync on reconnect
- Multilingual-ready voice locale switching (English + configurable local language)
- Population analytics dashboard (condition trends)
- Guideline engine for protocolized care steps
- Emergency escalation hub (nurse-doctor chat + ambulance dispatch)
- Prescription generation with electronic signature + insurer metadata
- Doctor-assistant chat mode
- Training/simulation mode with scoring
- Drug/resource awareness with alternatives
- Security with JWT, roles, and audit logs

## Quick Start (Local)

### One Command (Windows PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\run-dev.ps1
```

This command will:
- create backend virtualenv if missing
- install backend/frontend dependencies
- train the AI model
- start backend and frontend in two new terminals

Optional faster run (skip installs):

```powershell
powershell -ExecutionPolicy Bypass -File .\run-dev.ps1 -SkipInstall
```

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. AI Model

```bash
cd ai-model/src
python train.py
```

### 3. Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Seeded accounts:
- Nurse: `nurse@cliniq.app` / `Nurse123!`
- Admin: `admin@cliniq.app` / `Admin123!`

## API Endpoints

- `/auth/register`, `/auth/login`, `/auth/me`
- `/patients`
- `/predict`, `/predict/visit`
- `/encounters/workflow`, `/encounters/{encounter_id}/call-ambulance`
- `/encounters/patient/{patient_id}`
- `/doctor-chat`, `/doctor-chat/{encounter_id}`
- `/prescriptions`, `/prescriptions/patient/{patient_id}`
- `/records/visits/{patient_id}`, `/records/timeline`
- `/referrals`
- `/assistant/guidelines`, `/assistant/chat`
- `/users/me`, `/users/me/avatar`
- `/simulation/cases`, `/simulation/attempt`
- `/analytics/summary`, `/analytics/alerts`
- `/drugs`
- `/team-chat`

## Open-Source AI Advisor Options

ClinIQ advisor supports:
- `rule_based` (default fallback)
- `ollama` (local open-source LLM API)
- `huggingface` (Inference API)

Set in `backend/.env`:
- `ADVISOR_PROVIDER=ollama`
- `OLLAMA_URL=http://localhost:11434`
- `OLLAMA_MODEL=llama3.1:8b`

Or Hugging Face:
- `ADVISOR_PROVIDER=huggingface`
- `HF_API_URL=...`
- `HF_API_TOKEN=...`

## Deployment

See [docs/deployment.md](docs/deployment.md) and [docs/architecture.md](docs/architecture.md).
