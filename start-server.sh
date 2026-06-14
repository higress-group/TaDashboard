#!/bin/bash
cd /home/z/my-project

# Start the production server in background
HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js &
SERVER_PID=$!
echo "[$(date)] Server started: PID=$SERVER_PID"

# Keep-alive loop - ping the server every 5s
while kill -0 $SERVER_PID 2>/dev/null; do
  sleep 5
  curl -s -o /dev/null http://localhost:3000/ 2>/dev/null
done

echo "[$(date)] Server died, restarting in 2s..."
sleep 2
exec "$0"
