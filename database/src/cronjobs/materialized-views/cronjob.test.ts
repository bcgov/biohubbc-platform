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

test('refreshes both views in dependency order and commits', async () => {
  const { statements, end } = mockClient();
  await refreshMaterializedViews();
  assert.deepEqual(statements, [
    'BEGIN',
    'REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_all',
    'REFRESH MATERIALIZED VIEW bcgw.wld_telemetry_public',
    'COMMIT'
  ]);
  assert.equal(end.mock.callCount(), 1);
});

test('rolls back both refreshes if the second view fails and propagates the error', async () => {
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
