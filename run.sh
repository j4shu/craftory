#!/usr/bin/env bash
# Start Craftory: backend (FastAPI) + frontend (Vite) in one terminal.
# Hit Ctrl+C to stop both.

cd "$(dirname "$0")"

# --- Process cleanup (kill process groups, not just PIDs) ---
PGIDS=()

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "Shutting down..."
  for pgid in "${PGIDS[@]}"; do
    kill -- -"$pgid" 2>/dev/null
  done
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

# --- Start backend ---
echo "Starting backend on http://localhost:8000"
set -m  # enable job control so subshells get their own process groups
uv run uvicorn server:app --reload --port 8000 &
PGIDS+=($!)

# --- Start frontend ---
echo "Starting frontend on http://localhost:5173"
(cd frontend && npm run dev) &
PGIDS+=($!)
set +m

echo ""
echo "Craftory is running — open http://localhost:5173"
echo "Press Ctrl+C to stop."

wait
