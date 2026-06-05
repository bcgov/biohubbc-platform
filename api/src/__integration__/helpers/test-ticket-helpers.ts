import { Knex } from 'knex';

/**
 * Create a valid ticket record for system integration tests that use Knex directly.
 * Reuses a stable team (idempotent) and generates a unique ticket_slug.
 *
 * Mirrors the IDBConnection-based getOrCreateIntegrationTicketId in test-submission-helpers.ts.
 */
export async function getOrCreateTestTicketId(
  db: Knex,
  submissionId: number,
  uploadId: string,
  systemUserId: number
): Promise<string> {
  const teamName = 'System Integration Test Team';

  let team = await db('biohub.team').where('name', teamName).whereNull('record_end_date').first();
  if (!team) {
    [team] = await db('biohub.team')
      .insert({ name: teamName, description: 'Auto-created for system integration tests', create_user: systemUserId })
      .returning('*');
  }

  const {
    rows: [slugRow]
  } = await db.raw(`
    WITH day AS (SELECT TO_CHAR((now() AT TIME ZONE 'UTC')::date, 'DDD') AS d),
         seq AS (SELECT COALESCE(MAX(RIGHT(ticket_slug, 5)::integer), -1) + 1 AS n FROM biohub.ticket, day WHERE ticket_slug LIKE d || '%')
    SELECT d || LPAD(n::text, 5, '0') AS slug FROM day, seq
  `);

  const [ticket] = await db('biohub.ticket')
    .insert({
      ticket_slug: slugRow.slug,
      subject: 'New Submission',
      description: `Submission ${submissionId}. Upload: ${uploadId}`,
      team_id: team.team_id,
      create_user: systemUserId
    })
    .returning('ticket_id');

  await db('biohub.ticket_status').insert({
    ticket_id: ticket.ticket_id,
    status: 'open',
    create_user: systemUserId
  });

  return ticket.ticket_id;
}
