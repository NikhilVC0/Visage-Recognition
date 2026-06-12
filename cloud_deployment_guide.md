# Visage Cloud Deployment & DevOps Guide

Deploying an AI-powered face recognition application requires slightly more architectural consideration than a standard web app due to the heavy ONNX models. Below is the ultimate guide to taking your Visage tracker to the cloud using the most **cost-effective (Free/Low-Cost)** and robust methods available.

---

## 🏗️ Architecture & Hosting Strategy (The Low-Cost Path)

To keep costs near zero while maintaining performance, we will decouple the application into three distinct services: **Frontend**, **Database**, and **Backend**.

### 1. Database: PostgreSQL via Supabase or Neon (Free Tier)
SQLite is great for local development, but it will corrupt or lock up if used in a cloud container. You need a managed PostgreSQL database.
- **Top Choice:** [Supabase](https://supabase.com/) or [Neon.tech](https://neon.tech/)
- **Cost:** 100% Free for the base tier (500MB storage, which is plenty for embeddings and logs).
- **Action:** Create a project, grab the Postgres Connection URI, and place it in your backend `.env` as `DATABASE_URL`.

### 2. Frontend: Vercel or Netlify (Free Tier)
React apps are static files once compiled. You should never serve them from the same server doing heavy AI calculations.
- **Top Choice:** [Vercel](https://vercel.com/) (Best for React/Vite) or Netlify.
- **Cost:** 100% Free global CDN.
- **Action:** Connect your GitHub repo to Vercel. It will automatically build and deploy `frontend/` every time you push to the `main` branch.

### 3. Backend: Render or Railway (Low-Cost)
The FastAPI backend runs the ONNX Machine Learning models. **Free-tier cloud servers usually cap RAM at 512MB**, which is not enough to load the AI models into memory without crashing (OOM Error). 
- **Top Choice:** [Render](https://render.com/) or [Railway](https://railway.app/).
- **Cost:** ~$7/month for a basic container with 1GB-2GB RAM (Required for ONNX). 
- **Action:**
  1. Use the existing `docker-compose.yml` or deploy the `backend/` directory directly.
  2. Set your Environment Variables in the Render dashboard:
     - `FACE_MODEL_DEVICE="cpu"` *(Cloud GPUs are very expensive; CPU is fine for < 100 users)*
     - `CORS_ORIGINS="https://your-vercel-app.vercel.app"`
     - `DEBUG=False`

---

## 🚀 DevOps & CI/CD Pipelines

To automate your deployments (DevOps), you should use **GitHub Actions**.

Instead of manually deploying, create a file at `.github/workflows/deploy.yml`:
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ "main" ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
    - name: Run Pytest (Whitebox Tests)
      run: |
        cd backend
        pytest

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - name: Trigger Render Deploy Hook
      run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```
**How it works:** Whenever you push code, GitHub spins up a server, runs the Whitebox Pytest agents we just created, and *only if the tests pass*, it triggers your Render server to pull the new code and restart!

---

## 🐛 Monitoring, Error Logging & Debugging

When the app is in the cloud, you can't just look at your local terminal to see errors. You need observability.

### 1. Application Error Tracking: Sentry
If a user uploading a face causes the FastAPI backend to crash, you need to know exactly why and on what line of code.
- **Tool:** [Sentry.io](https://sentry.io/) (Free Developer Tier)
- **Integration:** Install the SDK (`pip install sentry-sdk`) and add 3 lines to `backend/app/main.py`:
  ```python
  import sentry_sdk
  sentry_sdk.init(
      dsn="YOUR_SENTRY_DSN_URL",
      traces_sample_rate=1.0,
  )
  ```
- **Result:** You get a beautiful dashboard showing stack traces, which user triggered the error, and what API payload caused it.

### 2. Uptime Monitoring: UptimeRobot
You need to know if your server goes down in the middle of the night.
- **Tool:** [UptimeRobot](https://uptimerobot.com/) (Free Tier)
- **Integration:** Point it to your `/api/health` endpoint.
- **Result:** It will ping the server every 5 minutes and send you an Email/SMS if it goes offline.

### 3. Centralized Logging: Datadog or Logtail
For debugging logic issues (e.g. "Why is John being marked as Absent?"), you need to read your Python `logger.info()` outputs.
- **Tool:** [BetterStack / Logtail](https://betterstack.com/) (Free Tier)
- **Result:** Instead of logging to the console, logs stream to a searchable cloud dashboard. You can search things like `query="confidence < 0.5"` to see all failed face detections.

---

> [!IMPORTANT]
> **Summary Checklist for Cloud Migration:**
> 1. [ ] Move SQLite data to a Supabase PostgreSQL instance.
> 2. [ ] Deploy Frontend to Vercel (Free).
> 3. [ ] Deploy Backend to Render (1GB+ RAM Tier - ~$7/mo).
> 4. [ ] Create a Sentry account and inject the SDK into `main.py`.
> 5. [ ] Configure `CORS_ORIGINS` on Render to allow Vercel.
> 6. [ ] Sleep peacefully knowing UptimeRobot will text you if anything breaks.
