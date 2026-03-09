import { SQL } from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTicketReference, TicketReference } from '../models/ticket-reference';
import { BaseRepository } from './base-repository';

/**
 * Repository for ticket_reference table operations.
 */
export class TicketReferenceRepository extends BaseRepository {
  /**
   * Insert a ticket_reference row.
   *
   * @param {CreateTicketReference} payload - Ticket reference payload.
   * @return {Promise<{ ticket_reference_id: string }>} Inserted ticket reference identifier.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof TicketReferenceRepository
   */
  async insertTicketReference(payload: CreateTicketReference): Promise<{ ticket_reference_id: string }> {
    const knex = getKnex();
    const query = knex('ticket_reference')
      .insert({
        source_ticket_id: payload.source_ticket_id,
        target_ticket_id: payload.target_ticket_id,
        relationship: payload.relationship
      })
      .returning(['ticket_reference_id']);

    const response = await this.connection.knex(query, z.object({ ticket_reference_id: z.string() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert ticket reference', [
        'TicketReferenceRepository->insertTicketReference',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete a ticket reference row scoped to a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketReferenceId - Ticket reference UUID.
   * @return {Promise<{ ticket_reference_id: string }>} Deleted ticket reference identifier.
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof TicketReferenceRepository
   */
  async deleteTicketReference(ticketId: string, ticketReferenceId: string): Promise<{ ticket_reference_id: string }> {
    const knex = getKnex();
    const query = knex('ticket_reference')
      .update({ record_end_date: knex.fn.now() })
      .where('ticket_reference_id', ticketReferenceId)
      .andWhere((builder) => builder.where('source_ticket_id', ticketId).orWhere('target_ticket_id', ticketId))
      .whereNull('record_end_date')
      .returning(['ticket_reference_id']);

    const response = await this.connection.knex(query, z.object({ ticket_reference_id: z.string() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete ticket reference', [
        'TicketReferenceRepository->deleteTicketReference',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a single ticket reference row by identifier.
   *
   * @param {string} ticketReferenceId - Ticket reference UUID.
   * @return {Promise<TicketReference>} Ticket reference row.
   * @throws {ApiExecuteSQLError} If exactly one row is not found.
   * @memberof TicketReferenceRepository
   */
  async getTicketReferenceById(ticketReferenceId: string): Promise<TicketReference> {
    const sqlStatement = SQL`
      SELECT
        tr.ticket_reference_id,
        tr.source_ticket_id,
        st.ticket_slug AS source_ticket_slug,
        st.subject AS source_ticket_subject,
        tr.target_ticket_id,
        tt.ticket_slug AS target_ticket_slug,
        tt.subject AS target_ticket_subject,
        tr.relationship,
        su.user_identifier,
        tr.create_date
      FROM ticket_reference tr
      JOIN ticket st
        ON st.ticket_id = tr.source_ticket_id
      JOIN ticket tt
        ON tt.ticket_id = tr.target_ticket_id
      JOIN "system_user" su
        ON su.system_user_id = tr.create_user
      WHERE tr.ticket_reference_id = ${ticketReferenceId}
        AND tr.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, TicketReference);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get ticket reference', [
        'TicketReferenceRepository->getTicketReferenceById',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get active references for a ticket where it is either source or target.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketReference[]>} Ticket reference rows.
   * @memberof TicketReferenceRepository
   */
  async getTicketReferencesForTicket(ticketId: string): Promise<TicketReference[]> {
    const sqlStatement = SQL`
      SELECT
        tr.ticket_reference_id,
        tr.source_ticket_id,
        st.ticket_slug AS source_ticket_slug,
        st.subject AS source_ticket_subject,
        tr.target_ticket_id,
        tt.ticket_slug AS target_ticket_slug,
        tt.subject AS target_ticket_subject,
        tr.relationship,
        su.user_identifier,
        tr.create_date
      FROM ticket_reference tr
      JOIN ticket st
        ON st.ticket_id = tr.source_ticket_id
      JOIN ticket tt
        ON tt.ticket_id = tr.target_ticket_id
      JOIN "system_user" su
        ON su.system_user_id = tr.create_user
      WHERE (tr.source_ticket_id = ${ticketId} OR tr.target_ticket_id = ${ticketId})
        AND tr.record_end_date IS NULL
      ORDER BY tr.create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, TicketReference);

    return response.rows;
  }
}
