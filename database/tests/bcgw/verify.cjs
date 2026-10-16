/* Run from database/: node tests/bcgw/verify.cjs
 * Uses the local Docker PostgreSQL service, a disposable database and a rolled-back
 * transaction. No existing database, migration history, or reader role is changed.
 */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json') });
const knex = require('knex')({ client: 'pg' });
const root = path.resolve(__dirname, '../../..');
const contract = require('./contract.json');
const views = Object.entries(contract.exports).map(([name, domain]) => ({ name, columns: contract.columns[domain] }));
const names = [
  '20260716000000_create_bcgw_schema.ts',
  '20260717000000_create_bcgw_observation_materialised_views.ts',
  '20260717010000_create_bcgw_telemetry_materialised_views.ts'
];
const migrations = names.map((name) => require(path.join(root, 'database/src/migrations', name)));
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const container = process.env.BCGW_TEST_CONTAINER || 'biohub-db-all-container';
const testDatabase = `bcgw_test_${process.pid}`;
const role = `bcgw-test-${process.pid}`;
process.env.DB_USER_BCGW = role;
process.env.DB_USER_BCGW_PASS = "fixture'password";
function psql(sql, database) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'sh',
      '-c',
      'exec psql -X -q -A -t -f - -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "${1:-$POSTGRES_DB}"',
      'sh',
      database || ''
    ],
    { input: sql, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
  );
}
async function capture(migration, direction) {
  const statements = [];
  await migration[direction]({ ref: (value) => knex.ref(value), raw: async (sql) => statements.push(sql) });
  return statements.join('\n');
}
(async () => {
  assert(
    process.argv.slice(2).every((arg) => ['--plans', '--legacy'].includes(arg)),
    'Supported options: --plans, --legacy'
  );
  const legacy = process.argv.includes('--legacy');
  const up = await Promise.all(migrations.map((m) => capture(m, 'up')));
  const down = await Promise.all([...migrations].reverse().map((m) => capture(m, 'down')));
  assert(
    !/\.data\b|#>|->|jsonb|ST_GeomFromGeoJSON|try_geom_from_geojson|\bCURSOR\b/i.test(up.slice(1).join('\n')),
    'views must use typed properties exclusively'
  );
  // Exercise the actual Knex filesystem migration source, including exclusion of support/test files.
  const config = require(path.join(root, 'database/src/knexfile')).default.development.migrations;
  const discovery = require('knex')({
    client: 'pg',
    migrations: { ...config, directory: path.join(root, 'database/src/migrations') }
  });
  const source = discovery.migrate.config.migrationSource;
  const discovered = (await source.getMigrations(['.ts'])).map((m) => source.getMigrationName(m));
  assert(names.every((name) => discovered.includes(name)));
  assert(!discovered.includes('20260717000000_bcgw_materialised_views.ts'));
  assert.deepEqual(
    discovered.filter((name) => names.includes(name)),
    names
  );
  await discovery.destroy();
  const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
  let sql =
    "BEGIN;\nSET LOCAL TIME ZONE 'UTC';\n" +
    (legacy ? read('legacy/fixtures.sql') + read('legacy/normalize.sql') : read('schema.sql') + read('fixtures.sql'));
  if (process.argv.includes('--plans')) sql += read('scale.sql');
  sql += up.join('\n') + '\nCREATE SCHEMA baseline;\n';
  if (legacy) sql += require('./legacy/compare.cjs')();
  // Assert the deployed contract, independent of query formatting or historical implementation.
  for (const view of views) {
    sql += `DO $$ BEGIN
      ASSERT (SELECT jsonb_agg(jsonb_build_object(
        'name', a.attname, 'type', format_type(a.atttypid,a.atttypmod),
        'comment', col_description(a.attrelid,a.attnum)) ORDER BY a.attnum)
        FROM pg_attribute a WHERE a.attrelid='bcgw.${view.name}'::regclass
          AND a.attnum>0 AND NOT a.attisdropped) = ${literal(JSON.stringify(view.columns))}::jsonb,
        '${view.name}: column contract';
      ASSERT NOT EXISTS (SELECT feature_id FROM bcgw.${view.name} GROUP BY feature_id HAVING count(*)>1),
        '${view.name}: one row per feature';
      ASSERT has_table_privilege(${literal(role)}, 'bcgw.${view.name}', 'SELECT');
    END $$;\n`;
  }
  sql += `DO $$ BEGIN
    ASSERT (SELECT count(*) FROM pg_matviews WHERE schemaname='bcgw')=6;
    ASSERT (SELECT count(*) FROM pg_views WHERE schemaname='bcgw_internal')=2;
    ASSERT has_schema_privilege(${literal(role)}, 'bcgw', 'USAGE');
    ASSERT NOT has_schema_privilege(${literal(role)}, 'bcgw_internal', 'USAGE');
    ASSERT NOT has_table_privilege(${literal(role)}, 'bcgw_internal.observation_export_rows', 'SELECT');
    ASSERT NOT has_table_privilege(${literal(role)}, 'bcgw_internal.telemetry_export_rows', 'SELECT');
  END $$;\n`;
  sql += read('structure-assertions.sql');
  if (process.argv.includes('--plans')) {
    sql += `CREATE TEMP TABLE query_plans (view_name text, plan jsonb);
      DO $$ DECLARE v record; plan json; BEGIN
        FOR v IN SELECT matviewname, definition FROM pg_matviews WHERE schemaname='bcgw' ORDER BY matviewname LOOP
          EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || v.definition INTO plan;
          INSERT INTO query_plans VALUES (v.matviewname, plan);
        END LOOP;
      END $$;
      SELECT json_agg(query_plans) FROM query_plans;\n`;
  }
  sql += fs.readFileSync(path.join(__dirname, 'assertions.sql'), 'utf8');
  // The same views must work with ingestion JSON removed entirely.
  for (const view of views) sql += `CREATE TABLE baseline.typed_${view.name} AS TABLE bcgw.${view.name};\n`;
  sql += "UPDATE biohub.submission_feature SET data = '{}';\n";
  for (const view of views) {
    sql += `REFRESH MATERIALIZED VIEW bcgw.${view.name};
      DO $$ BEGIN ASSERT NOT EXISTS (
        (SELECT * FROM baseline.typed_${view.name} EXCEPT ALL SELECT * FROM bcgw.${view.name}) UNION ALL
        (SELECT * FROM bcgw.${view.name} EXCEPT ALL SELECT * FROM baseline.typed_${view.name})
      ), 'JSON must not affect results'; END $$;\n`;
  }
  sql += fs.readFileSync(path.join(__dirname, 'property-assertions.sql'), 'utf8');
  sql +=
    down.join('\n') +
    `\nDO $$ BEGIN
    ASSERT NOT EXISTS (SELECT FROM pg_namespace WHERE nspname IN ('bcgw','bcgw_internal'));
    ASSERT NOT EXISTS (SELECT FROM pg_roles WHERE rolname=${literal(role)});
    ASSERT to_regprocedure('biohub.try_geom_from_geojson(text)') IS NOT NULL;
  END $$;\n`;
  sql += up.join('\n') + '\n' + down.join('\n') + '\nROLLBACK;\n';
  psql(`CREATE DATABASE ${testDatabase};`);
  try {
    const output = psql(sql, testDatabase);
    if (output.trim()) {
      const plans = JSON.parse(output);
      const destination =
        process.env.BCGW_PLAN_OUTPUT ||
        require('node:path').join(require('node:os').tmpdir(), 'bcgw-normalized-plans.json');
      fs.writeFileSync(destination, JSON.stringify(plans, null, 2) + '\n');
      console.table(
        plans.map((row) => ({
          view: row.view_name,
          rows: row.plan[0].Plan['Actual Rows'],
          milliseconds: row.plan[0]['Execution Time']
        }))
      );
      console.log(`Full EXPLAIN ANALYZE/BUFFERS plans: ${destination}`);
    }
    console.log(
      `PASS: typed properties; export partitions; independent refresh; private source views; columns/types/comments/grants; setup/rollback/replay${
        legacy ? '; historical comparisons' : ''
      }.`
    );
  } finally {
    psql(`DROP DATABASE ${testDatabase};`);
  }
  await knex.destroy();
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
