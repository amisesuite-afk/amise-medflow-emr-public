#!/bin/bash
# Starts API server and dashboard in background tmux panes (Codespace auto-start)
set -e

# Use port 3002 for dashboard to match existing Codespace forwarding
export PORT=3002
export BASE_PATH=/

echo "Starting Amise MedFlow EMR..."

# API server
pnpm --filter @workspace/api-server run dev &
API_PID=$!
echo "API server PID: $API_PID (port 8080)"

# Dashboard
pnpm --filter @workspace/dashboard run dev &
DASH_PID=$!
echo "Dashboard PID: $DASH_PID (port $PORT)"

echo ""
echo "Dashboard → http://localhost:$PORT"
echo "API       → http://localhost:8080"
echo ""
echo "Demo mode active — click 'Enter as Doctor' to start"
