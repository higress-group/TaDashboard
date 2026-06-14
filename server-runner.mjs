import { spawn } from 'child_process';
import http from 'http';

const PORT = 3000;

function startServer() {
  console.log(`[${new Date().toISOString()}] Starting Next.js server...`);
  
  const server = spawn('node', ['.next/standalone/server.js'], {
    env: { ...process.env, HOSTNAME: '0.0.0.0', PORT: String(PORT) },
    stdio: 'inherit'
  });
  
  server.on('exit', (code, signal) => {
    console.log(`[${new Date().toISOString()}] Server exited (code=${code}, signal=${signal}). Restarting in 2s...`);
    setTimeout(startServer, 2000);
  });
  
  // Self-ping every 3s to keep the process active
  const pinger = setInterval(() => {
    http.get(`http://localhost:${PORT}/`, (res) => {
      // Response received, server is alive
    }).on('error', () => {
      // Server might be starting up
    });
  }, 3000);
  
  server.on('exit', () => {
    clearInterval(pinger);
  });
}

startServer();
