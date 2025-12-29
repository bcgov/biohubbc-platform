/**
 * Integration tests for pg-boss queue system.
 * Uses the real dev PostgreSQL database to test job publishing and processing.
 *
 * Prerequisites:
 *   - Database running (make web)
 *   - .env file configured
 *
 * Run with:
 *   npm run test:integration
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
// Load .env from biohubbc-platform folder (parent of api/) BEFORE any imports
require('dotenv').config({ path: path.resolve(process.cwd(), '../.env') });

// Override DB host for local execution outside Docker
process.env.DB_HOST = 'localhost';

import { expect } from 'chai';
import { describe, it } from 'mocha';
import pg from 'pg';
import SQL from 'sql-template-strings';
import { getAPIUserDBConnection, initDBPool } from '../database/db';
import { initPgBoss } from '../queue/pg-boss-service';
import { publishTestJob } from '../queue/publisher';

// Create pool config AFTER dotenv has loaded env vars
const integrationPoolConfig: pg.PoolConfig = {
  user: process.env.DB_USER_API,
  password: process.env.DB_USER_API_PASS,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT),
  host: 'localhost',
  max: 10
};

describe('Queue Integration', () => {
  before(async function () {
    this.timeout(10000);
    initDBPool(integrationPoolConfig);
    await initPgBoss();
  });

  // Note: We don't stop pg-boss here because it's a singleton shared across test files.
  // The process exit will clean up the connection naturally.

  describe('publishTestJob', () => {
    it('publishes a test job and Docker worker processes it', async function () {
      this.timeout(15000);

      const testMessage = `integration-test-${Date.now()}`;

      // Publish the test job
      const jobId = await publishTestJob({ message: testMessage });

      expect(jobId).to.be.a('string');
      expect(jobId).to.have.lengthOf(36); // UUID format

      // Verify job was created in database
      const connection = getAPIUserDBConnection();
      await connection.open();

      const jobResult = await connection.sql<{ id: string; state: string; data: { message: string } }>(SQL`
        SELECT id, state, data
        FROM pgboss.job
        WHERE id = ${jobId}::uuid
      `);

      expect(jobResult.rowCount).to.equal(1);
      expect(jobResult.rows[0].data.message).to.equal(testMessage);

      // Wait for job to be processed by Docker queue worker (poll database state)
      const maxWaitMs = 10000;
      const pollIntervalMs = 200;
      let waited = 0;
      let jobState = jobResult.rows[0].state;

      while (jobState !== 'completed' && waited < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        waited += pollIntervalMs;

        const stateResult = await connection.sql<{ state: string }>(SQL`
          SELECT state
          FROM pgboss.job
          WHERE id = ${jobId}::uuid
        `);
        jobState = stateResult.rows[0]?.state || jobState;
      }

      // Verify job state changed to completed
      expect(jobState).to.equal('completed');

      await connection.rollback();
      connection.release();
    });

    it('creates job in database even before worker processes it', async function () {
      this.timeout(5000);

      // Use a unique singleton key to avoid conflicts
      const uniqueKey = `test-no-worker-${Date.now()}`;
      const testMessage = `no-worker-test-${Date.now()}`;

      // Publish job (no worker running for this specific test)
      const jobId = await publishTestJob({ message: testMessage }, { singletonKey: uniqueKey });

      expect(jobId).to.be.a('string');

      // Verify job exists in database with 'created' state
      const connection = getAPIUserDBConnection();
      await connection.open();

      const jobResult = await connection.sql<{ id: string; state: string }>(SQL`
        SELECT id, state
        FROM pgboss.job
        WHERE id = ${jobId}::uuid
      `);

      expect(jobResult.rowCount).to.equal(1);
      expect(jobResult.rows[0].state).to.equal('created');

      await connection.rollback();
      connection.release();
    });
  });
});
