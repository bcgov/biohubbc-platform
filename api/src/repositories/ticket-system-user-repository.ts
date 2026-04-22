import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  CreateTicketSystemUser,
  TicketSystemUser,
  TicketSystemUsersFilters,
  TicketSystemUserWithUser,
  UpdateTicketSystemUserStatusRequest
} from '../models/ticket-system-user';
import { BaseRepository } from './base-repository';

const TICKET_SYSTEM_USER_COLUMNS = ['ticket_system_user_id', 'ticket_id', 'system_user_id', 'status'] as const;

/**
 * Persistence layer for ticket system user records (`ticket_system_user`).
 *
 * Responsibilities:
 * - create and update ticket system user lifecycle status rows
 * - enforce active-row lookups (excluding soft-deleted records)
 * - join ticket system user rows to user profile information for API payloads
 */
export class TicketSystemUserRepository extends BaseRepository {
  /**
   * Find active ticket system users using optional filters.
   *
   * @param {TicketSystemUsersFilters} [filters] - Optional query filters.
   * @return {Promise<TicketSystemUser[]>} Matching active ticket system users.
   * @memberof TicketSystemUserRepository
   */
  async findTicketSystemUsers(filters?: TicketSystemUsersFilters): Promise<TicketSystemUser[]> {
    const knex = getKnex();
    const query = knex.table('ticket_system_user').select(TICKET_SYSTEM_USER_COLUMNS).whereNull('record_end_date');

    if (filters?.ticketId) {
      query.where('ticket_id', filters.ticketId);
    }

    if (filters?.ticketSystemUserId) {
      query.where('ticket_system_user_id', filters.ticketSystemUserId);
    }

    if (filters?.systemUserIds?.length) {
      query.whereIn('system_user_id', filters.systemUserIds);
    }

    const response = await this.connection.knex(query, TicketSystemUser);

    return response.rows;
  }

  /**
   * Insert a new ticket system user row.
   *
   * Behavior:
   * - persists one assignment record and returns canonical fields
   * - enforces a strict single-row write contract
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {CreateTicketSystemUser} createTicketSystemUser - Assignment payload.
   * @return {Promise<TicketSystemUser>} Inserted ticket system user row.
   * @throws {ApiExecuteSQLError} When rowCount is not exactly one.
   * @memberof TicketSystemUserRepository
   */
  async insertTicketSystemUser(
    ticketId: string,
    createTicketSystemUser: CreateTicketSystemUser
  ): Promise<TicketSystemUser> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .insert({
        ticket_id: ticketId,
        system_user_id: createTicketSystemUser.system_user_id,
        status: createTicketSystemUser.status
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
   * Get an active ticket system user by ticket id and ticket_system_user id.
   *
   * Active means `record_end_date IS NULL`.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketSystemUserId - ticket_system_user UUID.
   * @return {Promise<TicketSystemUser | null>} Matching active ticket system user, or null when not found.
   * @memberof TicketSystemUserRepository
   */
  async getTicketSystemUserByTicketAndSystemUserId(
    ticketId: string,
    ticketSystemUserId: string
  ): Promise<TicketSystemUser | null> {
    const rows = await this.findTicketSystemUsers({
      ticketId,
      ticketSystemUserId
    });

    return rows[0] ?? null;
  }

  /**
   * Update lifecycle status for a single active ticket system user row.
   *
   * Behavior:
   * - updates status only for active assignment records
   * - enforces a strict single-row write contract
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketSystemUserId - ticket_system_user UUID.
   * @param {UpdateTicketSystemUserStatusRequest} update - New status payload.
   * @return {Promise<TicketSystemUser>} Updated ticket system user row.
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
   * Soft delete an active ticket system user row by setting `record_end_date`.
   *
   * Behavior:
   * - marks an assignment inactive while preserving history
   * - enforces a strict single-row write contract
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
   * List all active ticket system users for a ticket with embedded system user fields.
   *
   * Behavior:
   * - returns current ticket system users with embedded user identity fields
   * - orders by display name (falling back to user identifier) for stable UI display
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketSystemUserWithUser[]>} Active ticket system user rows with nested user payload.
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
