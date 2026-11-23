// Integration test for the security scope feature bitmap — verifies the schema contract
// (the feature_ids roaringbitmap column on security_scope) against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running, migrations applied)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';

describe('Security scope feature bitmap (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  it('AC2: security_scope has a nullable feature_ids roaringbitmap column and the extension is installed', async () => {
    const columns = await connection.sql(SQL`
      SELECT is_nullable, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'biohub'
        AND table_name = 'security_scope'
        AND column_name = 'feature_ids'
    `);

    expect(columns.rows, 'biohub.security_scope.feature_ids column').to.have.length(1);
    expect(columns.rows[0].is_nullable).to.equal('YES');
    expect(columns.rows[0].udt_name).to.equal('roaringbitmap');

    const extensions = await connection.sql(SQL`
      SELECT extname
      FROM pg_extension
      WHERE extname = 'roaringbitmap'
    `);

    expect(extensions.rows, 'roaringbitmap extension').to.have.length(1);
  });
});
