import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { HTTP404 } from '../errors/http-error';
import {
  CreateTicketSystemUser,
  TicketSystemUser,
  TicketSystemUserWithUser,
  UpdateTicketSystemUserStatusRequest
} from '../models/ticket-system-user';
import { TicketSystemUserRepository } from '../repositories/ticket-system-user-repository';
import { DBService } from './db-service';

/**
 * Domain service for ticket system user lifecycle management.
 *
 * This service encapsulates:
 * - assignment creation for explicit ticket system users
 * - status updates for existing ticket system user rows
 * - ticket system user removal for existing rows
 * - retrieval of active ticket system user payloads for ticket detail responses
 */
export class TicketSystemUserService extends DBService {
  ticketSystemUserRepository: TicketSystemUserRepository;

  /**
   * Creates an instance of TicketSystemUserService.
   *
   * @param {IDBConnection} connection - Active request-scoped DB connection.
   * @memberof TicketSystemUserService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketSystemUserRepository = new TicketSystemUserRepository(connection);
  }

  /**
   * Create one or more explicit ticket system user rows for a ticket.
   *
   * Behavior:
   * - rejects the request when any incoming system user already has an active ticket_system_user row for the ticket
   * - returns created ticket system users in request order
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {CreateTicketSystemUser[]} payload - Ticket system user payloads.
   * @return {Promise<TicketSystemUser[]>} Newly created assignment rows.
   * @memberof TicketSystemUserService
   */
  async createTicketSystemUsers(ticketId: string, payload: CreateTicketSystemUser[]): Promise<TicketSystemUser[]> {
    const existingTicketSystemUsers = await this.ticketSystemUserRepository.findTicketSystemUsers({
      ticketId,
      systemUserIds: payload.map((ticketSystemUser) => ticketSystemUser.system_user_id)
    });

    if (existingTicketSystemUsers.length) {
      throw new ApiConflictError('One or more users are already assigned to this ticket');
    }

    return Promise.all(
      payload.map((ticketSystemUser) =>
        this.ticketSystemUserRepository.insertTicketSystemUser(ticketId, ticketSystemUser)
      )
    );
  }

  /**
   * Update ticket system user lifecycle status for an existing assignment.
   *
   * Behavior:
   * - changes the lifecycle status for an existing active assignment
   * - rejects updates when the ticket system user record does not exist
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketSystemUserId - ticket_system_user UUID.
   * @param {UpdateTicketSystemUserStatusRequest} payload - New status payload.
   * @return {Promise<TicketSystemUser>} Updated assignment row.
   * @throws {HTTP404} When the ticket system user row is not found.
   * @memberof TicketSystemUserService
   */
  async updateTicketSystemUserStatus(
    ticketId: string,
    ticketSystemUserId: string,
    payload: UpdateTicketSystemUserStatusRequest
  ): Promise<TicketSystemUser> {
    const existing = await this.ticketSystemUserRepository.getTicketSystemUserByTicketAndSystemUserId(
      ticketId,
      ticketSystemUserId
    );

    if (!existing) {
      throw new HTTP404('Ticket system user not found');
    }

    if (existing.status === payload.status) {
      throw new ApiConflictError('Ticket system user already has the requested status');
    }

    return this.ticketSystemUserRepository.updateTicketSystemUserStatus(ticketId, ticketSystemUserId, {
      status: payload.status
    });
  }

  /**
   * Soft delete a ticket system user row for a ticket.
   *
   * Behavior:
   * - ends an active assignment without removing historical auditability
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketSystemUserId - ticket_system_user UUID.
   * @return {Promise<void>}
   * @memberof TicketSystemUserService
   */
  async deleteTicketSystemUser(ticketId: string, ticketSystemUserId: string): Promise<void> {
    await this.ticketSystemUserRepository.softDeleteTicketSystemUser(ticketId, ticketSystemUserId);
  }

  /**
   * Return active ticket system users for a ticket with nested system user details.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketSystemUserWithUser[]>} Active assignment rows with user payload.
   * @memberof TicketSystemUserService
   */
  async getActiveTicketSystemUsersByTicketId(ticketId: string): Promise<TicketSystemUserWithUser[]> {
    return this.ticketSystemUserRepository.getActiveTicketSystemUsersByTicketId(ticketId);
  }
}
