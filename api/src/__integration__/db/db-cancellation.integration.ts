import { expect } from 'chai';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';

describe('database cancellation (integration)', function () {
  this.timeout(10000);

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  it('cancels an active query, rolls back, and leaves the pool reusable', async () => {
    const controller = new AbortController();
    const connection = getAPIUserDBConnection({ signal: controller.signal });

    await connection.open();
    await connection.query(`SET LOCAL statement_timeout = '5s'`);

    const queryStart = Date.now();
    const longQueryPromise = connection.query('SELECT pg_sleep(30)');

    // Give PostgreSQL time to begin pg_sleep before dispatching cancellation.
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort();

    let queryError: unknown;
    try {
      await longQueryPromise;
    } catch (error) {
      queryError = error;
    }

    expect(queryError).to.exist;
    expect(Date.now() - queryStart).to.be.lessThan(3000);

    await connection.rollback();
    await connection.release();

    let reuseConnection: IDBConnection | undefined;
    try {
      reuseConnection = getAPIUserDBConnection();
      await reuseConnection.open();
      const result = await reuseConnection.query<{ value: number }>('SELECT 1 AS value');

      expect(result.rows).to.deep.equal([{ value: 1 }]);
      await reuseConnection.rollback();
    } finally {
      await reuseConnection?.release();
    }
  });
});
