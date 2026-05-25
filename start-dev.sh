#!/bin/bash
# Amise MedFlow EMR — start both servers for Codespace / local dev
set -e

BRANCH="claude/claude-md-DXmYK"
DASHBOARD_PORT=${PORT:-3002}
API_PORT=8080

echo "=== Amise MedFlow EMR ==="

# Pull latest from the working branch
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
pnpm install --frozen-lockfile

# Kill anything already on the ports
lsof -ti:"$API_PORT" | xargs kill -9 2>/dev/null || true
lsof -ti:"$DASHBOARD_PORT" | xargs kill -9 2>/dev/null || true
sleep 1

# Start API server in background
echo "Starting API server on port $API_PORT..."
PORT=$API_PORT pnpm --filter @workspace/api-server run dev > /tmp/amise-api.log 2>&1 &
API_PID=$!

# Wait for API to be ready
for i in $(seq 1 20); do
  sleep 2
  if curl -s http://localhost:$API_PORT/healthz >/dev/null 2>&1; then
    echo "✓ API server ready (port $API_PORT)"
    break
  fi
  echo "  waiting for API... ($i)"
done

# Start dashboard in background
echo "Starting dashboard on port $DASHBOARD_PORT..."
PORT=$DASHBOARD_PORT BASE_PATH=/ pnpm --filter @workspace/dashboard run dev > /tmp/amise-dash.log 2>&1 &
DASH_PID=$!

# Wait for dashboard to be ready
for i in $(seq 1 20); do
  sleep 2
  if curl -s http://localhost:$DASHBOARD_PORT/ >/dev/null 2>&1; then
    echo "✓ Dashboard ready (port $DASHBOARD_PORT)"
    break
  fi
  echo "  waiting for dashboard... ($i)"
done

echo ""
echo "=== Ready ==="
echo "Dashboard → http://localhost:$DASHBOARD_PORT"
echo "API       → http://localhost:$API_PORT"
echo ""
echo "Click 'Enter as Doctor' in the browser to start."
echo "Logs: tail -f /tmp/amise-api.log  or  tail -f /tmp/amise-dash.log"
echo ""
# Keep script alive so Codespace doesn't kill the background processes
wait $API_PID $DASH_PID
