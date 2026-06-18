import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

// La carpeta db/ viaja dentro de la imagen del API (Dockerfile: COPY . .), asi
// que la leemos en runtime.
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db');

/**
 * Runner de migraciones simple y idempotente.
 *
 * Aplica los archivos db/*.sql en orden alfabetico, una sola vez cada uno,
 * registrando los aplicados en la tabla schema_migrations. Reemplaza al
 * mecanismo docker-entrypoint-initdb.d (que solo corre con la DB vacia): asi
 * las migraciones nuevas tambien se aplican sobre una base ya existente.
 *
 * Todos los .sql estan escritos para ser idempotentes (CREATE ... IF NOT EXISTS,
 * ADD COLUMN IF NOT EXISTS, ON CONFLICT, etc.), asi que aunque un archivo se
 * corra sobre una DB que ya lo tenia, no rompe nada.
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        ran++;
        console.log(`[migrate] aplicada ${file}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        // Re-lanzamos con contexto: index.js aborta el arranque si esto falla.
        err.message = `migracion ${file}: ${err.message}`;
        throw err;
      }
    }

    console.log(ran === 0 ? '[migrate] DB al dia, nada que aplicar' : `[migrate] ${ran} migracion(es) aplicada(s)`);
  } finally {
    client.release();
  }
}
