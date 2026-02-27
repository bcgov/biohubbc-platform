import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { TicketStatus as TicketStatusEnum } from '../models/ticket';
import { TicketStatus } from '../models/ticket-status';
import { BaseRepository } from './base-repository';

/**
 * Repository for ticket_status table operations.
 */
export class TicketStatusRepository extends BaseRepository {
  /**
   * Insert an immutable status history entry for a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {TicketStatusEnum} status - Status value to append.
   * @return {Promise<TicketStatus>} Created status row.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof TicketStatusRepository
   */
  async insertTicketStatus(ticketId: string, status: TicketStatusEnum): Promise<TicketStatus> {
    const sqlStatement = SQL`
      INSERT INTO ticket_status (
        ticket_id,
        status
      ) VALUES (
        ${ticketId},
        ${status}
      )
      RETURNING
        ticket_status_history_id,
        ticket_id,
        (
          SELECT su.user_identifier
          FROM "system_user" su
          WHERE su.system_user_id = create_user
        ),
        create_date,
        status;
    `;

    const response = await this.connection.sql(sqlStatement, TicketStatus);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert ticket status', [
        'TicketStatusRepository->insertTicketStatus',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get status history rows for a ticket ordered oldest first.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketStatus[]>} Status rows.
   * @memberof TicketStatusRepository
   */
  async getTicketStatus(ticketId: string): Promise<TicketStatus[]> {
    const sqlStatement = SQL`
      SELECT
        tsh.ticket_status_history_id,
        tsh.ticket_id,
        su.user_identifier,
        tsh.create_date,
        tsh.status
      FROM ticket_status tsh
      JOIN "system_user" su
        ON su.system_user_id = tsh.create_user
      WHERE tsh.ticket_id = ${ticketId}
      ORDER BY tsh.create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, TicketStatus);

    return response.rows;
  }
}
