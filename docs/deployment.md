# Deployment Guide

## Frontend (Vercel)
1. Import `frontend/` as a project in Vercel.
2. Framework preset: Next.js.
3. Set env var:
   - `NEXT_PUBLIC_API_BASE_URL=https://<your-backend-url>`
4. Deploy.

## Backend (Render/Railway/Fly.io)
1. Deploy `backend/` as a Python web service.
2. Start command:
   - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Install command:
   - `pip install -r requirements.txt`
4. Environment variables:
   - `SECRET_KEY`
   - `ALGORITHM=HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES=480`
   - `DATABASE_URL=postgresql+psycopg://...`
   - `ALLOWED_ORIGINS=https://<frontend-domain>`

## Database
- Recommended: managed PostgreSQL (free tier on Render/Railway/Supabase).
- Backend auto-creates tables on startup.

## Notes for Low-Resource Operation
- Keep payloads small and compress responses at edge/CDN.
- Use PWA install mode for shared tablets/phones.
- Keep AI model file local to backend runtime for resilient inference.
