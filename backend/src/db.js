import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: config.db.max,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // A backend error on an idle client shouldn't crash the process.
  console.error('Unexpected Postgres pool error:', err.message);
});

export const query = (text, params) => pool.query(text, params);

// Used by the readiness probe.
export async function ping() {
  await pool.query('SELECT 1');
}
