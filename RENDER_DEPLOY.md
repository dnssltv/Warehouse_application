# Deploy to Render

## What is already prepared

- `render.yaml` at repository root (Blueprint deploy):
  - `warehouse-backend` (Python web service)
  - `warehouse-frontend` (Vite static site)
  - `warehouse-db` (managed PostgreSQL)
- Backend config supports Render `DATABASE_URL`.
- Frontend static routing fallback (`/* -> /index.html`) configured in Blueprint.
- Persistent disk configured for uploads (`warehouse-uploads`).

## Deploy steps

1. Push this repository to GitHub.
2. In Render dashboard: **New + -> Blueprint**.
3. Select the repository and deploy using `render.yaml`.
4. After first deploy:
   - Open backend service env vars and set `ADMIN_PASSWORD`.
   - Copy actual backend URL and set `VITE_API_BASE_URL` in frontend env to:
     - `https://<your-backend>.onrender.com/api`
   - Open backend env and set `CORS_ORIGINS` to:
     - `["https://<your-frontend>.onrender.com"]`
5. Trigger redeploy for both services.

## Health checks

- Backend: `GET /` returns JSON with `status: ok`.
- Frontend should load and call backend without CORS errors.

## Notes

- `SYNC_ADMIN_ON_STARTUP` is set to `false` in `render.yaml` by default (safer in production).
- Upload files are stored on the persistent disk mounted to:
  - `/opt/render/project/src/backend/uploads`
