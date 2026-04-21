import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  CreateTicketSystemUser,
  TicketSystemUser,
  TicketSystemUserWithUser,
  UpdateTicketSystemUserStatusRequest
} from '../models/ticket-system-user';
import { BaseRepository } from './base-repository';

const TICKET_SYSTEM_USER_COLUMNS = ['ticket_system_user_id', 'ticket_id', 'system_user_id', 'status'] as const;

/**
 * Persistence layer for ticket assignee records (`ticket_system_user`).
 *
 * Responsibilities:
 * - create and update assignee lifecycle status rows
 * - enforce active-row lookups (excluding soft-deleted records)
 * - join assignee rows to user profile information for API payloads
 */
export class TicketSystemUserRepository extends BaseRepository {
  /**
   * Insert a new ticket assignee row.
   *
   * Behavior:
   * - writes a single active `ticket_system_user` record
   * - returns canonical assignment columns from the inserted row
   * - throws when the insert does not affect exactly one row
   *
   * @param {{ ticket_id: string } & CreateTicketSystemUser} ticketSystemUser - Assignment payload including ticket id.
   * @return {Promise<TicketSystemUser>} Inserted assignee row.
   * @throws {ApiExecuteSQLError} When rowCount is not exactly one.
   * @memberof TicketSystemUserRepository
   */
  async insertTicketSystemUser(
    ticketSystemUser: { ticket_id: string } & CreateTicketSystemUser
  ): Promise<TicketSystemUser> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .insert({
        ticket_id: ticketSystemUser.ticket_id,
        system_user_id: ticketSystemUser.system_user_id,
        status: ticketSystemUser.status
      })
      .returning(TICKET_SYSTEM_USER_COLUMNS);

    const response = await this.connection.knex(query, TicketSystemUser);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert ticket system user', [
        'TicketSystemUserRepository->insertTicketSystemUser',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find an active assignee by ticket id and system user id.
   *
   * Active means `record_end_date IS NULL`.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {number} systemUserId - System user id.
   * @return {Promise<TicketSystemUser | null>} Matching active assignee, or null when not found.
   * @memberof TicketSystemUserRepository
   */
  async getActiveTicketSystemUserByTicketAndSystemUser(
    ticketId: string,
    systemUserId: number
  ): Promise<TicketSystemUser | null> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .select(TICKET_SYSTEM_USER_COLUMNS)
      .where('ticket_id', ticketId)
      .andWhere('system_user_id', systemUserId)
      .whereNull('record_end_date')
      .first();

    const response = await this.connection.knex(query, TicketSystemUser);

    return response.rows[0] ?? null;
  }

  /**
   * Find an active assignee by ticket id and ticket_system_user id.
   *
   * Active means `record_end_date IS NULL`.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketSystemUserId - ticket_system_user UUID.
   * @return {Promise<TicketSystemUser | null>} Matching active assignee, or null when not found.
   * @memberof TicketSystemUserRepository
   */
  async getActiveTicketSystemUserById(ticketId: string, ticketSystemUserId: string): Promise<TicketSystemUser | null> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .select(TICKET_SYSTEM_USER_COLUMNS)
      .where('ticket_id', ticketId)
      .andWhere('ticket_system_user_id', ticketSystemUserId)
      .whereNull('record_end_date')
      .first();

    const response = await this.connection.knex(query, TicketSystemUser);

    return response.rows[0] ?? null;
  }

  /**
   * Update lifecycle status for a single active assignee row.
   *
   * Behavior:
   * - updates status only when the row is active (`record_end_date IS NULL`)
   * - returns updated canonical assignment columns
   * - throws when zero or multiple rows are affected
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketSystemUserId - ticket_system_user UUID.
   * @param {UpdateTicketSystemUserStatusRequest} update - New status payload.
   * @return {Promise<TicketSystemUser>} Updated assignee row.
   * @throws {ApiExecuteSQLError} When rowCount is not exactly one.
   * @memberof TicketSystemUserRepository
   */
  async updateTicketSystemUserStatus(
    ticketId: string,
    ticketSystemUserId: string,
    update: UpdateTicketSystemUserStatusRequest
  ): Promise<TicketSystemUser> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .update({
        status: update.status
      })
      .where('ticket_id', ticketId)
      .andWhere('ticket_system_user_id', ticketSystemUserId)
      .whereNull('record_end_date')
      .returning(TICKET_SYSTEM_USER_COLUMNS);

    const response = await this.connection.knex(query, TicketSystemUser);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update ticket system user', [
        'TicketSystemUserRepository->updateTicketSystemUserStatus',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete an active assignee row by setting `record_end_date`.
   *
   * Behavior:
   * - targets only active rows (`record_end_date IS NULL`)
   * - throws when zero or multiple rows are affected
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketSystemUserId - ticket_system_user UUID.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} When rowCount is not exactly one.
   * @memberof TicketSystemUserRepository
   */
  async softDeleteTicketSystemUser(ticketId: string, ticketSystemUserId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('ticket_id', ticketId)
      .andWhere('ticket_system_user_id', ticketSystemUserId)
      .whereNull('record_end_date')
      .returning(['ticket_system_user_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete ticket system user', [
        'TicketSystemUserRepository->softDeleteTicketSystemUser',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }

  /**
   * List all active assignees for a ticket with embedded system user fields.
   *
   * Behavior:
   * - filters to active assignee rows only
   * - joins `ticket_system_user` to `system_user`
   * - orders display by display_name fallback user_identifier for stable UI presentation
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketSystemUserWithUser[]>} Active assignee rows with nested user payload.
   * @memberof TicketSystemUserRepository
   */
  async getActiveTicketSystemUsersByTicketId(ticketId: string): Promise<TicketSystemUserWithUser[]> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user as tsu')
      .select([
        'tsu.ticket_system_user_id',
        'tsu.ticket_id',
        'tsu.system_user_id',
        'tsu.status',
        knex.raw(
          `json_build_object(
            'system_user_id', su.system_user_id,
            'display_name', su.display_name,
            'user_identifier', su.user_identifier,
            'email', su.email
          ) as system_user`
        )
      ])
      .innerJoin('system_user as su', 'su.system_user_id', 'tsu.system_user_id')
      .where('tsu.ticket_id', ticketId)
      .whereNull('tsu.record_end_date')
      .orderByRaw('COALESCE(su.display_name, su.user_identifier) ASC');

    const response = await this.connection.knex(query, TicketSystemUserWithUser);

    return response.rows;
  }
}
