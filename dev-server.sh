#!/bin/bash
# Auto-restart dev server script
# The Next.js dev server sometimes gets OOM-killed in container environments
# This script automatically restarts it when it dies

PORT=3000
LOG_FILE="/tmp/nextdev-autorestart.log"

echo "Starting auto-restart dev server on port $PORT..." | tee -a "$LOG_FILE"

while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Next.js dev server..." | tee -a "$LOG_FILE"
  
  npx next dev -p $PORT 2>&1 | tee -a "$LOG_FILE"
  EXIT_CODE=$?
  
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server exited with code $EXIT_CODE. Restarting in 3s..." | tee -a "$LOG_FILE"
  sleep 3
done
