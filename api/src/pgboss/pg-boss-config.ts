import PgBoss from 'pg-boss';

/**
 * Get pg-boss configuration from environment variables.
 *
 * Note: migrate is set to false because the pgboss schema is created
 * via database migrations (see 20251219000000_pgboss_schema.ts).
 * This follows the principle of least privilege by not requiring
 * CREATE ON DATABASE for the application user.
 *
 * @return {*}  {PgBoss.ConstructorOptions}
 */
export const getPgBossConfig = (): PgBoss.ConstructorOptions => ({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER_API,
  password: process.env.DB_USER_API_PASS,
  schema: 'pgboss', // Separate schema from biohub

  // Schema is managed via database migrations, not pg-boss
  migrate: false,

  // Maintenance settings
  archiveCompletedAfterSeconds: 60 * 60 * 24 * 7, // 7 days
  deleteAfterDays: 30,

  // Monitoring
  monitorStateIntervalSeconds: 30
});
