# 🚀 Visage GitHub & Cloud Deployment Guide

This guide provides a step-by-step process for securely pushing your Visage project to GitHub and hooking it up to cloud hosting platforms (Vercel & Render) for continuous deployment.

---

## Step 1: Secure Your Repository

Before pushing anything to the internet, we must ensure sensitive data (passwords, user faces, databases) is excluded.

I have already created a **master `.gitignore`** in the root of your project. It automatically blocks:
- 🚫 `backend/.env` (Your secret keys and settings)
- 🚫 `backend/uploads/` (User face images)
- 🚫 `backend/*.db` (Your local SQLite database)
- 🚫 `node_modules/` and `venv/` (Heavy dependency folders)

> **WARNING:** Never commit your `.env` file! Your `.env.example` will be pushed safely so others know what variables are required, but your actual `.env` file containing secrets will stay secure on your local PC.

---

## Step 2: Push to GitHub

Open a terminal in the root folder of your project (`d:\AG Projects\ai attendance tracker`) and run these commands:

```bash
# 1. Initialize a new Git repository
git init

# 2. Add all safe files to the staging area
git add .

# 3. Commit your code
git commit -m "Initial commit: Visage Core MVP"

# 4. Rename default branch to main
git branch -M main

# 5. Link your GitHub repository (Replace YOUR_USERNAME and YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 6. Push the code to GitHub
git push -u origin main
```

---

## Step 3: Deploy Frontend to Vercel (Free)

Vercel is the best place to host your React/Vite frontend. It will automatically build and deploy every time you push to GitHub.

1. Go to [Vercel](https://vercel.com/) and create a free account linked to your GitHub.
2. Click **Add New Project**.
3. Import your `Visage` GitHub repository.
4. **Important Configurations:**
   - **Framework Preset:** Vite
   - **Root Directory:** Edit this and select `frontend` (Since the React app is inside the frontend folder).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Click **Deploy**. Vercel will give you a public URL (e.g., `https://visage-frontend.vercel.app`).

> **IMPORTANT:** Save the Vercel URL you get here. You will need to put it into the Backend's CORS settings so the backend accepts requests from it!

---

## Step 4: Deploy Backend to Render

Render is excellent for Python FastAPI backends.

1. Go to [Render](https://render.com/) and sign in with GitHub.
2. Click **New +** and select **Web Service**.
3. Select your `Visage` GitHub repository.
4. **Important Configurations:**
   - **Root Directory:** `backend`
   - **Environment:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Since you are running AI face models, select a tier with at least 1GB to 2GB of RAM to prevent Out-Of-Memory (OOM) crashes.
5. **Environment Variables:** Scroll down to Advanced and add these environment variables:
   - `FACE_MODEL_DEVICE`: `cpu` *(Crucial: Forces the AI to run on CPU since cloud GPUs are expensive)*
   - `CORS_ORIGINS`: `["https://your-vercel-app-url.vercel.app"]` *(Paste your Vercel URL here)*
   - `DATABASE_URL`: `postgresql://your-supabase-db-url` *(Create a free PostgreSQL database on Supabase or Neon.tech and paste the connection string here. Do not use SQLite.)*
6. Click **Create Web Service**.

---

## Step 5: Continuous Deployment

You're done! Because both Vercel and Render are connected to your GitHub, any time you run `git push origin main` on your local PC in the future:
1. GitHub will receive the code.
2. Vercel will automatically rebuild the frontend.
3. Render will automatically rebuild the backend.
4. Your live app will seamlessly update!
