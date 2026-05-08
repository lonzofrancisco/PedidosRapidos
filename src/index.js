import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[pedidos-rapidos] listening on :${env.port} (${env.nodeEnv})`);
});

const shutdown = async (signal) => {
  console.log(`[pedidos-rapidos] ${signal} received, shutting down`);
  server.close(() => {});
  await pool.end().catch(() => {});
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
