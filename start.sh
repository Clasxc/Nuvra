#!/usr/bin/env bash
# start.sh — One-command boot for NUVRA dev environment.
# Starts backend on 0.0.0.0:8000 (LAN-accessible) and frontend on 0.0.0.0:8080.

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Detect this machine's LAN IP so we can print the connection URL for teammates
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LAN_IP" ]; then LAN_IP="localhost"; fi

echo "─────────────────────────────────────────────────────"
echo "  NUVRA dev environment"
echo "─────────────────────────────────────────────────────"
echo "  Frontend (this machine):  http://localhost:8080"
echo "  Frontend (teammates):     http://${LAN_IP}:8080"
echo "  Backend API:              http://${LAN_IP}:8000"
echo "─────────────────────────────────────────────────────"

# Kill any prior instances on these ports (clean restart)
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Start backend in background, log to /tmp/nuvra-backend.log
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/nuvra-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID  (logs: /tmp/nuvra-backend.log)"

# Wait for backend
echo "Waiting for backend to come up…"
for i in {1..15}; do
  if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "Backend ready."
    break
  fi
  sleep 1
done

# Start frontend (foreground)
echo "Starting frontend (Ctrl+C to stop everything)…"
echo ""

# Trap so backend dies when frontend Ctrl+C is hit
trap "kill $BACKEND_PID 2>/dev/null || true; pkill -f vite 2>/dev/null || true; exit 0" INT TERM

npm run dev -- --host 0.0.0.0
