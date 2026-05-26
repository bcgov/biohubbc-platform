import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { BaseRepository } from './base-repository';

/**
 * Repository for ticket_comment_artifact table operations.
 */
export class TicketCommentArtifactRepository extends BaseRepository {
  /**
   * Soft delete all active artifact references for a ticket comment.
   *
   * @param {string} ticketCommentId - Ticket comment UUID.
   * @return {Promise<void>}
   * @memberof TicketCommentArtifactRepository
   */
  async deleteTicketCommentArtifacts(ticketCommentId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('ticket_comment_artifact')
      .update({ record_end_date: knex.fn.now() })
      .where('ticket_comment_id', ticketCommentId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }

  /**
   * Update active artifact references for a ticket comment.
   *
   * Only active ticket artifacts belonging to the same ticket are inserted.
   * Invalid or cross-ticket references are ignored so unresolved markdown keeps
   * rendering as missing.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketCommentId - Ticket comment UUID.
   * @param {string[]} ticketArtifactIds - Parsed ticket artifact UUIDs.
   * @return {Promise<void>}
   * @memberof TicketCommentArtifactRepository
   */
  async updateTicketCommentArtifacts(
    ticketId: string,
    ticketCommentId: string,
    ticketArtifactIds: string[]
  ): Promise<void> {
    await this.deleteTicketCommentArtifacts(ticketCommentId);

    if (!ticketArtifactIds.length) {
      return;
    }

    const sqlStatement = SQL`
      WITH input_ticket_artifacts AS (
        SELECT DISTINCT ticket_artifact_id
        FROM UNNEST(${ticketArtifactIds}::uuid[]) AS t(ticket_artifact_id)
      )
      INSERT INTO ticket_comment_artifact (
        ticket_comment_id,
        ticket_artifact_id
      )
      SELECT
        ${ticketCommentId}::uuid,
        ta.ticket_artifact_id
      FROM input_ticket_artifacts ita
      JOIN ticket_artifact ta
        ON ta.ticket_artifact_id = ita.ticket_artifact_id
        AND ta.ticket_id = ${ticketId}
        AND ta.record_end_date IS NULL
      ON CONFLICT (ticket_comment_id, ticket_artifact_id)
      WHERE record_end_date IS NULL
      DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }
}
