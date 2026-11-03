// Integration tests for delayed derived-cache recompute jobs, against a real pg-boss instance.
//
// The first publish queues a delayed job under its singleton key, and the queue's `short` policy absorbs every
// later publish for that key until the job starts, so a burst of edits runs one recompute.
//
// Unlike most DB integration tests this one COMMITS: pg-boss deduplicates against committed queued jobs. The
// jobs are sent for a random, nonexistent security scope and deleted in `after`.
//
// Run: make test-db
// Requires: database container running with migrations applied.

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { defaultPoolConfig, getAPIUserDBConnection, initDBPool } from '../../database/db';
import { JobQueues } from '../../queue/jobs';
import { initPgBoss, stopPgBoss } from '../../queue/pg-boss-service';
import { publishComputeScopeAnchorsJob, PublishJobResult } from '../../queue/publisher';

const QueuedJob = z.object({ id: z.string(), singleton_key: z.string(), start_after: z.string() });
type QueuedJob = z.infer<typeof QueuedJob>;

describe('Delayed recompute jobs (integration)', function () {
  this.timeout(30000);

  const securityScopeId = randomUUID();

  before(async () => {
    initDBPool(defaultPoolConfig);
    const boss = await initPgBoss();
    // The worker creates this queue with the `short` policy that keeps one queued job per singleton key.
    await boss.createQueue(JobQueues.COMPUTE_SCOPE_ANCHORS, { policy: 'short' });
  });

  after(async () => {
    const connection = getAPIUserDBConnection();
    await connection.open();
    await connection.sql(SQL`
      DELETE FROM pgboss.job
      WHERE name = ${JobQueues.COMPUTE_SCOPE_ANCHORS}
        AND singleton_key LIKE ${`scope-anchors-${securityScopeId}%`}
    `);
    await connection.commit();
    connection.release();
    await stopPgBoss();
  });

  /**
   * Publish an anchor recompute for the test scope in its own committed transaction.
   *
   * @param {number} submissionId Submission the recompute is limited to.
   * @returns {Promise<PublishJobResult>} The publish result.
   */
  async function publishCommitted(submissionId: number): Promise<PublishJobResult> {
    const connection = getAPIUserDBConnection();
    await connection.open();
    const result = await publishComputeScopeAnchorsJob(connection, { securityScopeId, submissionId });
    await connection.commit();
    connection.release();
    return result;
  }

  /**
   * Read the queued jobs for the test scope.
   *
   * @returns {Promise<QueuedJob[]>} Queued jobs, ordered by singleton key.
   */
  async function readQueuedJobs(): Promise<QueuedJob[]> {
    const connection = getAPIUserDBConnection();
    await connection.open();
    const response = await connection.sql(
      SQL`
        SELECT id::text AS id, singleton_key, start_after
        FROM pgboss.job
        WHERE name = ${JobQueues.COMPUTE_SCOPE_ANCHORS}
          AND singleton_key LIKE ${`scope-anchors-${securityScopeId}%`}
          AND state = 'created'
        ORDER BY singleton_key
      `,
      QueuedJob
    );
    await connection.commit();
    connection.release();
    return response.rows;
  }

  it('queues one delayed job per key and absorbs later publishes into it', async () => {
    const first = await publishCommitted(1);
    const [queuedAfterFirst] = await readQueuedJobs();

    const second = await publishCommitted(1);
    const queuedAfterSecond = await readQueuedJobs();

    expect(first.status).to.equal('published');
    expect(second.status).to.equal('duplicate');
    // Starts in the future, so edits made in the meantime are covered by this one run.
    expect(Date.parse(queuedAfterFirst.start_after)).to.be.greaterThan(Date.now());
    expect(queuedAfterSecond).to.eql([queuedAfterFirst]);
  });

  it('queues a separate job for a different key', async () => {
    const result = await publishCommitted(2);
    const queued = await readQueuedJobs();

    expect(result.status).to.equal('published');
    expect(queued.map((job) => job.singleton_key)).to.eql([
      `scope-anchors-${securityScopeId}-submission-1`,
      `scope-anchors-${securityScopeId}-submission-2`
    ]);
  });
});
