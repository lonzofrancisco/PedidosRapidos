import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { runMigrations } from './config/migrate.js';
import { startTrialReminderJob } from './jobs/trialReminders.js';
import { replaceConsole } from './utils/logger.js';

// Inicializar logger centralizado (console.log/error/warn van a Loki si está disponible)
replaceConsole();

// Aplica migraciones pendientes (db/*.sql) antes de aceptar trafico. Si fallan,
// abortamos: mejor no arrancar que servir con la DB a medio migrar.
try {
  await runMigrations();
} catch (err) {
  console.error('[pedidos-rapidos] migraciones fallaron, abortando:', err.message);
  process.exit(1);
}

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[pedidos-rapidos] listening on :${env.port} (${env.nodeEnv})`);
});

// Aviso de fin de prueba por email (no-op si SMTP no esta configurado).
startTrialReminderJob();

const shutdown = async (signal) => {
  console.log(`[pedidos-rapidos] ${signal} received, shutting down`);
  server.close(() => {});
  await pool.end().catch(() => {});
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
