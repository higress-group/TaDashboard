#!/bin/bash
# Keep-alive: starts server and pings it every 3s to prevent idle kill
cd /home/z/my-project

while true; do
  echo "[$(date '+%H:%M:%S')] Starting server..."
  HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js &
  SERVER_PID=$!
  
  # Wait for server to be ready
  sleep 2
  
  # Ping loop
  while kill -0 $SERVER_PID 2>/dev/null; do
    curl -s -o /dev/null http://localhost:3000/ 2>/dev/null
    sleep 3
  done
  
  echo "[$(date '+%H:%M:%S')] Server died, restarting in 2s..."
  sleep 2
done
