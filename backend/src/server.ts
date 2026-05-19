import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { closePool } from './config/database';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Smart Logistics API server running on port ${PORT}`);
});

// Graceful shutdown helper
async function gracefulShutdown(signal: string) {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await closePool();
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default server;
