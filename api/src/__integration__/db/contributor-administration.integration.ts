import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ContributorService } from '../../services/contributor-service';
import { ContributorSystemUserService } from '../../services/contributor-system-user-service';
import { UserService } from '../../services/user-service';
import { createTestSubmission } from '../helpers/test-submission-helpers';

describe('Contributor administration database integration', () => {
  let connection: IDBConnection;
  let contributorService: ContributorService;
  let contributorSystemUserService: ContributorSystemUserService;
  let userId: number;
  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    contributorService = new ContributorService(connection);
    contributorSystemUserService = new ContributorSystemUserService(connection);
    const user = await connection.sql(SQL`
   INSERT INTO "system_user" (user_identity_source_id, user_identifier, user_guid, record_effective_date)
   SELECT user_identity_source_id, ${'contributor-test-' + randomUUID()}, ${randomUUID()}, now()
   FROM user_identity_source WHERE name = 'SYSTEM' LIMIT 1 RETURNING system_user_id;
  `);
    userId = user.rows[0].system_user_id;
  });
  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  it('excludes ended contributors from list pages and pagination totals', async () => {
    const keyword = randomUUID();
    const active = await contributorService.insertAdministrativeContributor({
      clientId: `${keyword}-active`,
      description: null
    });
    const ended = await contributorService.insertAdministrativeContributor({
      clientId: `${keyword}-ended`,
      description: null
    });
    await contributorService.deleteAdministrativeContributor(ended.contributor_id);

    for (const activeOnly of [undefined, false, true]) {
      const result = await contributorService.listAdministrativeContributors(
        { keyword, activeOnly },
        { page: 1, limit: 1 }
      );
      expect(result.contributors.map((row) => row.contributor_id)).eql([active.contributor_id]);
      expect(result.pagination.total).equals(1);
      const nextPage = await contributorService.listAdministrativeContributors(
        { keyword, activeOnly },
        { page: 2, limit: 1 }
      );
      expect(nextPage.contributors).eql([]);
      expect(nextPage.pagination.total).equals(1);
    }
  });

  it('creates a relationship and supports repeated DELETE', async () => {
    const first = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const created = await contributorSystemUserService.insertAdministrativeContributorSystemUser({
      contributorId: first.contributor_id,
      systemUserId: userId
    });
    await contributorSystemUserService.deleteAdministrativeContributorSystemUser(created.contributor_system_user_id);
    const ended = await contributorSystemUserService.getAdministrativeContributorSystemUser(
      created.contributor_system_user_id
    );
    await contributorSystemUserService.deleteAdministrativeContributorSystemUser(created.contributor_system_user_id);
    const repeated = await contributorSystemUserService.getAdministrativeContributorSystemUser(
      created.contributor_system_user_id
    );
    expect(ended.record_end_date).not.to.be.null;
    expect(repeated.record_end_date).equals(ended.record_end_date);
  });

  it('ends relationships atomically, retains submission references, and rolls deletion back', async () => {
    const contributor = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const link = await contributorSystemUserService.insertAdministrativeContributorSystemUser({
      contributorId: contributor.contributor_id,
      systemUserId: userId
    });
    const submissionId = await createTestSubmission(connection);
    await connection.sql(
      SQL`UPDATE submission SET contributor_id = ${contributor.contributor_id} WHERE submission_id = ${submissionId}`
    );
    await connection.sql(SQL`SAVEPOINT before_delete`);
    await contributorService.deleteAdministrativeContributor(contributor.contributor_id);
    const ended = await contributorService.getAdministrativeContributor(contributor.contributor_id);
    const endedLink = await contributorSystemUserService.getAdministrativeContributorSystemUser(
      link.contributor_system_user_id
    );
    expect(ended.record_end_date).not.to.be.null;
    expect(endedLink.record_end_date).equals(ended.record_end_date);
    expect(await contributorSystemUserService.findContributorSystemUser(userId)).to.be.null;
    const submission = await connection.sql(
      SQL`SELECT contributor_id FROM submission WHERE submission_id = ${submissionId}`
    );
    expect(submission.rows[0].contributor_id).equals(contributor.contributor_id);
    await contributorService.deleteAdministrativeContributor(contributor.contributor_id);
    expect((await contributorService.getAdministrativeContributor(contributor.contributor_id)).record_end_date).equals(
      ended.record_end_date
    );
    await connection.sql(SQL`ROLLBACK TO SAVEPOINT before_delete`);
    expect((await contributorService.getAdministrativeContributor(contributor.contributor_id)).record_end_date).to.be
      .null;
    expect(
      (await contributorSystemUserService.getAdministrativeContributorSystemUser(link.contributor_system_user_id))
        .record_end_date
    ).to.be.null;
  });

  it('isolates relationship pages by contributor and returns totals for empty pages', async () => {
    const first = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const second = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    await contributorSystemUserService.insertAdministrativeContributorSystemUser({
      contributorId: first.contributor_id,
      systemUserId: userId
    });
    const page = await contributorSystemUserService.listAdministrativeContributorSystemUsers(
      { contributorId: first.contributor_id },
      { page: 2, limit: 1 }
    );
    expect(page.contributor_users).eql([]);
    expect(page.pagination.total).equals(1);
    const other = await contributorSystemUserService.listAdministrativeContributorSystemUsers(
      { contributorId: second.contributor_id },
      { page: 1, limit: 10 }
    );
    expect(other.contributor_users).eql([]);
    expect(other.pagination.total).equals(0);
  });

  it('includes service accounts in assignment options and rejects occupied users', async () => {
    const first = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const second = await contributorService.insertAdministrativeContributor({
      clientId: randomUUID(),
      description: null
    });
    const userService = new UserService(connection);
    const page = await userService.listContributorSystemUserOptions(
      { keyword: 'contributor-test-' },
      { page: 1, limit: 100 }
    );
    expect(page.users.some((user) => user.system_user_id === userId)).is.true;
    await contributorSystemUserService.insertAdministrativeContributorSystemUser({
      contributorId: first.contributor_id,
      systemUserId: userId
    });
    try {
      await contributorSystemUserService.insertAdministrativeContributorSystemUser({
        contributorId: second.contributor_id,
        systemUserId: userId
      });
      expect.fail();
    } catch (error) {
      expect((error as Error).message).contains('already has an active');
    }
  });
});

/**
 * Wait until a competing database connection is actually blocked by a row/index lock.
 * @param observer - Independent transaction used to inspect PostgreSQL lock state.
 * @param pid - Competing backend process.
 * @returns Completion after a lock wait is observed.
 */
async function waitForDatabaseLock(observer: IDBConnection, pid: number): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await observer.sql(SQL`SELECT cardinality(pg_blocking_pids(${pid})) AS blockers`);
    if (result.rows[0].blockers > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Expected competing transaction to wait for a database lock');
}

/**
 * Capture a concurrent operation's failure without an unhandled rejection.
 * @param operation - Competing database operation.
 * @returns The error, or undefined if the operation succeeded.
 */
async function captureFailure(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('Contributor administration concurrent transactions', () => {
  let left: IDBConnection;
  let right: IDBConnection;
  let userId: number;
  let firstId: number;
  let secondId: number;
  let prefix: string;
  let rightPid: number;

  beforeEach(async () => {
    prefix = randomUUID();
    const fixture = getAPIUserDBConnection();
    await fixture.open();
    try {
      const user = await fixture.sql(SQL`
        INSERT INTO "system_user" (user_identity_source_id, user_identifier, user_guid)
        SELECT user_identity_source_id, ${prefix}, ${randomUUID()} FROM user_identity_source WHERE name = 'SYSTEM'
        RETURNING system_user_id
      `);
      userId = user.rows[0].system_user_id;
      const contributorService = new ContributorService(fixture);
      firstId = (
        await contributorService.insertAdministrativeContributor({ clientId: `${prefix}-first`, description: null })
      ).contributor_id;
      secondId = (
        await contributorService.insertAdministrativeContributor({ clientId: `${prefix}-second`, description: null })
      ).contributor_id;
      await fixture.commit();
    } catch (error) {
      await fixture.rollback();
      throw error;
    } finally {
      fixture.release();
    }
    left = getAPIUserDBConnection();
    right = getAPIUserDBConnection();
    await left.open();
    await right.open();
    const backend = await right.sql(SQL`SELECT pg_backend_pid() AS pid`);
    rightPid = backend.rows[0].pid;
  });

  afterEach(async () => {
    // Release the blocker first so a pending competitor can finish and roll back.
    await left.rollback();
    left.release();
    await right.rollback();
    right.release();
    const cleanup = getAPIUserDBConnection();
    await cleanup.open();
    try {
      await cleanup.sql(SQL`DELETE FROM contributor_system_user WHERE contributor_id IN (${firstId}, ${secondId})`);
      await cleanup.sql(SQL`DELETE FROM contributor WHERE client_id LIKE ${prefix + '%'}`);
      await cleanup.sql(SQL`DELETE FROM "system_user" WHERE system_user_id = ${userId}`);
      await cleanup.commit();
    } catch (error) {
      await cleanup.rollback();
      throw error;
    } finally {
      cleanup.release();
    }
  });

  it('allows only one concurrent contributor creation for the same client ID', async () => {
    const input = { clientId: `${prefix}-duplicate`, description: null };
    await new ContributorService(left).insertAdministrativeContributor(input);
    const failure = captureFailure(new ContributorService(right).insertAdministrativeContributor(input));
    await waitForDatabaseLock(left, rightPid);
    await left.commit();
    const error = await failure;
    expect(error).not.to.be.undefined;
    // The database index, rather than the preliminary lookup, rejects the race.
    expect((error as { errors: unknown[] }).errors).not.to.be.empty;
  });

  it('allows only one active concurrent assignment for a system user', async () => {
    await new ContributorSystemUserService(left).insertAdministrativeContributorSystemUser({
      contributorId: firstId,
      systemUserId: userId
    });
    const failure = captureFailure(
      new ContributorSystemUserService(right).insertAdministrativeContributorSystemUser({
        contributorId: secondId,
        systemUserId: userId
      })
    );
    await waitForDatabaseLock(left, rightPid);
    await left.commit();
    const error = await failure;
    expect((error as Error).message).contains('already has an active');
  });

  it('prevents a new relationship from surviving concurrent contributor deletion', async () => {
    await new ContributorService(left).deleteAdministrativeContributor(firstId);
    const failure = captureFailure(
      new ContributorSystemUserService(right).insertAdministrativeContributorSystemUser({
        contributorId: firstId,
        systemUserId: userId
      })
    );
    await waitForDatabaseLock(left, rightPid);
    await left.commit();
    const error = await failure;
    expect((error as Error).message).equals('Select an active contributor');
    const links = await right.sql(
      SQL`SELECT contributor_system_user_id FROM contributor_system_user WHERE contributor_id = ${firstId} AND record_end_date IS NULL`
    );
    expect(links.rows).eql([]);
  });
});
