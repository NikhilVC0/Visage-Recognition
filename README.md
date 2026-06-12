# 🎓 Visage Core MVP — AI-Powered Face Recognition Attendance System

A camera-based attendance system leveraging **Visage** (open-source face recognition) for real-time, high-precision student detection, automated logging, and actionable analytics.

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** (for frontend)
- Webcam (for face registration and recognition)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy environment config
copy .env.example .env  # Windows
# cp .env.example .env  # macOS/Linux

# Configure .env variables (e.g. FACE_MODEL_DEVICE, CORS_ORIGINS)
# Note: For production/cloud, use PostgreSQL in DATABASE_URL.

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: **http://localhost:8000**
- API Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run the dev server
npm run dev
```

The dashboard will be available at: **http://localhost:5173**

### Default Admin Login
- **Username:** `admin`
- **Password:** `admin123`

### Important Configuration (`.env`)
- `FACE_MODEL_DEVICE`: Set to `cpu`, `gpu`, or `auto` depending on your hardware. (Use `cpu` for most cheap cloud deployments).
- `CORS_ORIGINS`: Add your frontend URL here so the backend accepts requests. (e.g., `["http://localhost:5173"]`).
- `DATABASE_URL`: Defaults to local SQLite. **For cloud deployment**, you must use a PostgreSQL database (like Supabase or Neon).

---

## 🏗 Architecture

```
┌──────────────────────────┐
│    React + Vite Frontend │
│    (Dashboard, Camera)   │
└──────────┬───────────────┘
           │ REST API
┌──────────▼───────────────┐
│    FastAPI Backend        │
│    ├── Auth (JWT)         │
│    ├── Students CRUD      │
│    ├── Face Engine        │
│    ├── Attendance Logs    │
│    ├── Analytics          │
│    └── Export (CSV/PDF)   │
└──────────┬───────────────┘
     ┌─────┼─────┐
     ▼     ▼     ▼
   SQLite   Visage   OpenCV
```

## 🧠 Face Recognition Stack

| Component | Technology |
|-----------|-----------|
| Detection | SCRFD via Visage (ONNX) |
| Recognition | ArcFace embeddings (512-dim) |
| Anti-spoofing | MiniFASNet liveness detection |
| Image Processing | OpenCV |

## 📊 Features

- ✅ Face registration with quality validation
- ✅ Real-time face recognition (< 200ms)
- ✅ Anti-spoofing / liveness detection
- ✅ Automated attendance logging (entry/exit)
- ✅ Admin dashboard with analytics
- ✅ Attendance session management
- ✅ Search, filter, and export logs (CSV, PDF)
- ✅ Manual attendance override
- ✅ JWT authentication with role-based access
- ✅ Segregated Local (Docker) & Cloud Deployment pipelines

## 📁 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── config.py        # Settings
│   │   ├── database.py      # SQLAlchemy async
│   │   ├── models/          # ORM models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # Business logic
│   │   └── utils/           # Security, helpers
│   ├── tests/               # Test suite
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # React pages
│   │   ├── components/      # Shared UI components
│   │   ├── api/             # API client
│   │   └── context/         # Auth context
│   └── package.json
│
├── deploy/
│   ├── docker-local/        # Local PC docker-compose stack
│   └── cloud-render/        # Cloud Infrastructure-as-Code files
└── cloud_deployment_guide.md
```

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login → JWT token |
| POST | `/api/auth/register` | Create user (admin) |
| GET | `/api/students` | List students |
| POST | `/api/students` | Add student |
| POST | `/api/recognition/register` | Register face |
| POST | `/api/recognition/identify` | Identify face |
| POST | `/api/attendance/sessions` | Create session |
| GET | `/api/attendance/logs` | Get logs |
| GET | `/api/analytics/dashboard` | Dashboard stats |
| GET | `/api/export/csv` | Export CSV |
| GET | `/api/export/pdf` | Export PDF |

## 📈 Success Metrics

- 🎯 Recognition accuracy > 95% (target: 99%+)
- ⚡ Face match latency < 200ms
- 🛡 Anti-spoofing blocks photo/video attacks
- 📉 90% reduction in manual attendance time

## 📜 License

This project is for educational/institutional use. Visage and its models are open-source. See individual library licenses for commercial use requirements.
