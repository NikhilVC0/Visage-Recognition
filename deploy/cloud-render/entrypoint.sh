#!/bin/bash
set -e

echo "Running Database Migrations (if any)..."
# We could run alembic here, but since this project uses init_db on startup
# the app itself handles table creation. We'll just boot the app directly.

echo "Starting Uvicorn Server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
