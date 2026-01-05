import PgBoss from 'pg-boss';

/**
 * Get pg-boss configuration from environment variables.
 *
 * @return {*}  {PgBoss.ConstructorOptions}
 */
export const getPgBossConfig = (): PgBoss.ConstructorOptions => {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER_API,
    password: process.env.DB_USER_API_PASS,
    schema: 'pgboss', // Separate schema from biohub

    // Schema is managed via database migrations, not pg-boss
    migrate: false,

    // Monitoring interval (how often pg-boss checks for work)
    monitorIntervalSeconds: 30
  };
};
