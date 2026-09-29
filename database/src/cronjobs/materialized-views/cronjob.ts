import { readFileSync } from 'node:fs';
import { Client } from 'pg';

/** Refresh both telemetry views atomically, in dependency order. */
export async function refreshMaterializedViews() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_ADMIN,
    password: process.env.DB_ADMIN_PASS,
    ssl: process.env.PG_SSL_CA_PATH ? { ca: readFileSync(process.env.PG_SSL_CA_PATH) } : false,
    connectionTimeoutMillis: 30000,
    statement_timeout: 3600000,
    application_name: 'materialized-view-refresh'
  });

  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      await client.query('REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_all');
      await client.query('REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public');
      await client.query('COMMIT');
      return { refreshedViews: ['bcgw.wld_telemetry_all', 'bcgw.wld_telemetry_public'] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}
