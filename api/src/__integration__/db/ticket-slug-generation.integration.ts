// Integration test for concurrent ticket slug generation.
//
// Two transactions create tickets at the same time. The second waits on the slug generation lock, so it must
// read the slug the first one committed and generate the next one rather than the same slug.
//
// Unlike most DB integration tests this one COMMITS: the race only exists across committed transactions.
// The tickets and their teams are deleted in `after`.
//
// Run: make test-db
// Requires: database container running with seed data.

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { Ticket } from '../../models/ticket';
import { TicketService } from '../../services/ticket-service';

describe('Ticket slug generation (integration)', function () {
  this.timeout(15000);

  const createdTickets: Ticket[] = [];

  before(() => initDBPool(defaultPoolConfig));

  after(async () => {
    const connection = getAPIUserDBConnection();
    await connection.open();
    const ticketIds = createdTickets.map((ticket) => ticket.ticket_id);
    const teamIds = createdTickets.map((ticket) => ticket.team_id);
    await connection.sql(SQL`DELETE FROM ticket_status WHERE ticket_id = ANY(${ticketIds}::uuid[])`);
    await connection.sql(SQL`DELETE FROM ticket WHERE ticket_id = ANY(${ticketIds}::uuid[])`);
    await connection.sql(SQL`DELETE FROM team WHERE team_id = ANY(${teamIds}::uuid[])`);
    await connection.commit();
    connection.release();
  });

  /**
   * Create one ticket on its own connection, holding the transaction open until `release` resolves.
   *
   * @param {string} subject Ticket subject.
   * @param {Promise<void>} release Resolves when the transaction may commit.
   * @returns {Promise<Ticket>} The committed ticket.
   */
  async function createTicketInTransaction(subject: string, release: Promise<void>): Promise<Ticket> {
    const connection: IDBConnection = getAPIUserDBConnection();
    await connection.open();

    try {
      const ticket = await new TicketService(connection).createTicket({
        subject,
        description: null,
        priority: 'medium',
        systemUserIds: []
      });
      await release;
      await connection.commit();
      createdTickets.push(ticket);
      return ticket;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Wait until the given number of sessions hold, and the given number wait on, the ticket slug lock.
   *
   * `pg_locks` is read live (unlike `pg_stat_activity`, which is snapshotted per transaction), so polling from one
   * open transaction observes the other sessions as they progress.
   *
   * @param {IDBConnection} monitor Open connection used only to read `pg_locks`.
   * @param {{ granted: number; waiting: number }} expected Sessions holding and waiting on the lock.
   * @returns {Promise<void>} Resolves once the lock reaches the expected state.
   * @throws {Error} When the lock does not reach the expected state within five seconds.
   */
  async function waitForSlugLock(
    monitor: IDBConnection,
    expected: { granted: number; waiting: number }
  ): Promise<void> {
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      const response = await monitor.sql(SQL`
        SELECT
          count(*) FILTER (WHERE granted)::integer AS granted,
          count(*) FILTER (WHERE NOT granted)::integer AS waiting
        FROM pg_locks
        WHERE locktype = 'advisory'
          AND objid::bigint = (hashtext('ticket_slug_generation')::bigint & 4294967295)
      `);
      const { granted, waiting } = response.rows[0];

      if (granted === expected.granted && waiting === expected.waiting) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(`Ticket slug lock did not reach ${JSON.stringify(expected)}`);
  }

  it('gives concurrently created tickets distinct slugs', async () => {
    const runId = randomUUID().slice(0, 8);
    let releaseFirst: () => void = () => undefined;
    const firstMayCommit = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const monitor = getAPIUserDBConnection();
    await monitor.open();

    try {
      // The first ticket holds the slug lock in an open transaction; the second must be waiting on it before the
      // first commits, otherwise the race is not exercised.
      const first = createTicketInTransaction(`slug-race-${runId}-a`, firstMayCommit);
      await waitForSlugLock(monitor, { granted: 1, waiting: 0 });
      const second = createTicketInTransaction(`slug-race-${runId}-b`, Promise.resolve());
      await waitForSlugLock(monitor, { granted: 1, waiting: 1 });
      releaseFirst();

      const [firstTicket, secondTicket] = await Promise.all([first, second]);

      expect(secondTicket.ticket_slug).not.to.equal(firstTicket.ticket_slug);
      // Consecutive only because test:db runs serially: no other ticket is created between the two.
      expect(Number(secondTicket.ticket_slug)).to.equal(Number(firstTicket.ticket_slug) + 1);
    } finally {
      releaseFirst();
      await monitor.rollback();
      monitor.release();
    }
  });
});
