import { readFileSync } from 'node:fs';
import { Client } from 'pg';

// Keep this list aligned with the BCGW materialized views created by the migrations.
const MATERIALIZED_VIEWS = [
  'bcgw.wld_telemetry_all',
  'bcgw.wld_telemetry_public',
  'bcgw.wld_observations_all',
  'bcgw.wld_observations_public',
  'bcgw.wld_incidental_all',
  'bcgw.wld_incidental_public'
] as const;

/** Refresh all six BCGW materialized views in one transaction. */
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
      for (const view of MATERIALIZED_VIEWS) {
        await client.query(`REFRESH MATERIALIZED VIEW ${view}`);
      }
      await client.query('COMMIT');
      return { refreshedViews: [...MATERIALIZED_VIEWS] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}
