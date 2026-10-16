import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { Client } from 'pg';
import { refreshMaterializedViews } from './cronjob';

afterEach(() => mock.restoreAll());

function mockClient(failOn?: string) {
  const statements: string[] = [];
  mock.method(Client.prototype, 'connect', async () => {
    if (failOn === 'connect') {
      throw new Error('Connection failed');
    }
  });
  mock.method(Client.prototype, 'query', async (sql: string) => {
    statements.push(sql);
    if (sql === failOn) {
      throw new Error('Refresh failed');
    }
  });
  const end = mock.method(Client.prototype, 'end', async () => undefined);
  return { statements, end };
}

test('refreshes all six BCGW views and commits', async () => {
  const { statements, end } = mockClient();
  const result = await refreshMaterializedViews();
  assert.deepEqual(statements, [
    'BEGIN',
    'REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_all',
    'REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public',
    'REFRESH MATERIALIZED VIEW bcgw.wld_observations_all',
    'REFRESH MATERIALIZED VIEW bcgw.wld_observations_public',
    'REFRESH MATERIALIZED VIEW bcgw.wld_incidental_all',
    'REFRESH MATERIALIZED VIEW bcgw.wld_incidental_public',
    'COMMIT'
  ]);
  assert.deepEqual(result.refreshedViews, [
    'bcgw.wld_telemetry_all',
    'bcgw.wld_telemetry_public',
    'bcgw.wld_observations_all',
    'bcgw.wld_observations_public',
    'bcgw.wld_incidental_all',
    'bcgw.wld_incidental_public'
  ]);
  assert.equal(end.mock.callCount(), 1);
});

test('rolls back when the second view fails and skips the remaining views', async () => {
  const { statements, end } = mockClient('REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public');
  await assert.rejects(refreshMaterializedViews(), /Refresh failed/);
  assert.deepEqual(statements, [
    'BEGIN',
    'REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_all',
    'REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public',
    'ROLLBACK'
  ]);
  assert.equal(end.mock.callCount(), 1);
});

test('stops before the second refresh when the first view fails', async () => {
  const { statements, end } = mockClient('REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_all');
  await assert.rejects(refreshMaterializedViews(), /Refresh failed/);
  assert.deepEqual(statements, ['BEGIN', 'REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_all', 'ROLLBACK']);
  assert.equal(end.mock.callCount(), 1);
});

test('cleans up and propagates connection failures', async () => {
  const { statements, end } = mockClient('connect');
  await assert.rejects(refreshMaterializedViews(), /Connection failed/);
  assert.deepEqual(statements, []);
  assert.equal(end.mock.callCount(), 1);
});

test('rolls back the whole batch when the final incidental view fails', async () => {
  const { statements, end } = mockClient('REFRESH MATERIALIZED VIEW bcgw.wld_incidental_public');
  await assert.rejects(refreshMaterializedViews(), /Refresh failed/);
  assert.deepEqual(statements, [
    'BEGIN',
    'REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_all',
    'REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public',
    'REFRESH MATERIALIZED VIEW bcgw.wld_observations_all',
    'REFRESH MATERIALIZED VIEW bcgw.wld_observations_public',
    'REFRESH MATERIALIZED VIEW bcgw.wld_incidental_all',
    'REFRESH MATERIALIZED VIEW bcgw.wld_incidental_public',
    'ROLLBACK'
  ]);
  assert.equal(end.mock.callCount(), 1);
});
