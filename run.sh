#!/usr/bin/env bash
# Start Craftory: backend (FastAPI) + frontend (Vite) in one terminal.
# Hit Ctrl+C to stop both.

cd "$(dirname "$0")"

cleanup() {
  trap - EXIT INT TERM
  kill 0 2>/dev/null
  wait 2>/dev/null
}
trap cleanup INT TERM EXIT

echo "Starting backend on http://localhost:8000"
uv run uvicorn server:app --reload --port 8000 &

echo "Starting frontend on http://localhost:5173"
(cd frontend && npm run dev) &

echo ""
echo "Craftory is running — open http://localhost:5173"
echo "Press Ctrl+C to stop."

wait