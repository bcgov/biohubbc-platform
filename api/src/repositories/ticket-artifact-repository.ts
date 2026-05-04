import { SQL } from 'sql-template-strings';
import { TicketArtifact } from '../models/ticket-artifact';
import { BaseRepository } from './base-repository';

/**
 * Repository for ticket attachment links.
 */
export class TicketArtifactRepository extends BaseRepository {
  /**
   * Insert active ticket attachment associations.
   *
   * @param {string} ticketId - Owning ticket UUID.
   * @param {string[]} artifactIds - Underlying artifact UUIDs to attach.
   * @returns {Promise<TicketArtifact[]>} Active ticket attachments for the requested artifacts.
   * @memberof TicketArtifactRepository
   */
  async insertTicketArtifacts(ticketId: string, artifactIds: string[]): Promise<TicketArtifact[]> {
    if (!artifactIds.length) {
      return [];
    }

    const sqlStatement = SQL`
      WITH input_artifacts AS (
        SELECT DISTINCT artifact_id
        FROM UNNEST(${artifactIds}::uuid[]) AS t(artifact_id)
      ),
      -- Keep inserted rows available to the final result.
      inserted AS (
        INSERT INTO ticket_artifact (
          ticket_id,
          artifact_id
        )
        SELECT
          ${ticketId}::uuid,
          input_artifacts.artifact_id
        FROM input_artifacts
        ON CONFLICT (ticket_id, artifact_id)
        WHERE record_end_date IS NULL
        DO NOTHING
        RETURNING ticket_artifact_id, ticket_id, artifact_id, record_end_date, create_date
      ),
      -- Include matching rows that were already active.
      active_ticket_artifacts AS (
        SELECT
          inserted.ticket_artifact_id,
          inserted.ticket_id,
          inserted.artifact_id,
          inserted.record_end_date,
          inserted.create_date
        FROM inserted

        UNION

        SELECT
          ta.ticket_artifact_id,
          ta.ticket_id,
          ta.artifact_id,
          ta.record_end_date,
          ta.create_date
        FROM ticket_artifact ta
        JOIN input_artifacts ia
          ON ia.artifact_id = ta.artifact_id
        WHERE ta.ticket_id = ${ticketId}
          AND ta.record_end_date IS NULL
      )
      SELECT
        ata.ticket_artifact_id,
        ata.ticket_id,
        ata.artifact_id,
        ata.record_end_date,
        ata.create_date,
        a.object_key AS key
      FROM active_ticket_artifacts ata
      JOIN artifact a
        ON a.artifact_id = ata.artifact_id
      ORDER BY ata.create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, TicketArtifact);

    return response.rows;
  }

  /**
   * Find one active ticket attachment.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketArtifactId - Ticket artifact UUID.
   * @returns {Promise<TicketArtifact | null>} Active attachment row, or null when absent.
   * @memberof TicketArtifactRepository
   */
  async findTicketArtifactById(ticketId: string, ticketArtifactId: string): Promise<TicketArtifact | null> {
    const sqlStatement = SQL`
      SELECT
        ta.ticket_artifact_id,
        ta.ticket_id,
        ta.artifact_id,
        ta.record_end_date,
        ta.create_date,
        a.object_key AS key
      FROM ticket_artifact ta
      JOIN artifact a
        ON a.artifact_id = ta.artifact_id
      WHERE ta.ticket_id = ${ticketId}
        AND ta.ticket_artifact_id = ${ticketArtifactId}
        AND ta.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, TicketArtifact);

    return response.rows[0] ?? null;
  }

  /**
   * List active ticket attachments.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<TicketArtifact[]>} Active attachments ordered by creation time.
   * @memberof TicketArtifactRepository
   */
  async getTicketArtifacts(ticketId: string): Promise<TicketArtifact[]> {
    const sqlStatement = SQL`
      SELECT
        ta.ticket_artifact_id,
        ta.ticket_id,
        ta.artifact_id,
        ta.record_end_date,
        ta.create_date,
        a.object_key AS key
      FROM ticket_artifact ta
      JOIN artifact a
        ON a.artifact_id = ta.artifact_id
      WHERE ta.ticket_id = ${ticketId}
        AND ta.record_end_date IS NULL
      ORDER BY ta.create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, TicketArtifact);

    return response.rows;
  }
}
