import { IDBConnection } from '../database/db';
import { HTTP404, HTTP409 } from '../errors/http-error';
import {
  CreateTicketSystemUser,
  TicketSystemUser,
  TicketSystemUserWithUser,
  UpdateTicketSystemUserStatusRequest
} from '../models/ticket-system-user';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketSystemUserRepository } from '../repositories/ticket-system-user-repository';
import { DBService } from './db-service';
import { UserService } from './user-service';

/**
 * Domain service for ticket assignee lifecycle management.
 *
 * This service encapsulates:
 * - assignment creation validation (ticket and user existence, duplicate prevention)
 * - status updates for existing assignee rows
 * - assignee removal for existing rows
 * - retrieval of active assignee payloads for ticket detail responses
 */
export class TicketSystemUserService extends DBService {
  ticketRepository: TicketRepository;
  ticketSystemUserRepository: TicketSystemUserRepository;
  userService: UserService;

  /**
   * Creates an instance of TicketSystemUserService.
   *
   * @param {IDBConnection} connection - Active request-scoped DB connection.
   * @memberof TicketSystemUserService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketRepository = new TicketRepository(connection);
    this.ticketSystemUserRepository = new TicketSystemUserRepository(connection);
    this.userService = new UserService(connection);
  }

  /**
   * Create one or more explicit assignee rows for a ticket.
   *
   * Behavior:
   * - verifies the ticket exists
   * - verifies each target system user exists
   * - rejects duplicate system user ids within the request payload
   * - rejects duplicate active assignment for each ticket/user pair
   * - inserts rows into `ticket_system_user`
   *
   * Note:
   * - route-level authorization enforces admin-only access for this operation.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {CreateTicketSystemUser[]} payload - Assignment payloads.
   * @return {Promise<TicketSystemUser[]>} Newly created assignment rows.
   * @throws {HTTP404} When ticket or user does not exist.
   * @throws {HTTP409} When duplicate users are provided or an active assignment already exists.
   * @memberof TicketSystemUserService
   */
  async createTicketAssignees(ticketId: string, payload: CreateTicketSystemUser[]): Promise<TicketSystemUser[]> {
    await this.ticketRepository.getTicketById(ticketId);

    const uniqueSystemUserIds = new Set(payload.map((assignee) => assignee.system_user_id));

    if (uniqueSystemUserIds.size !== payload.length) {
      throw new HTTP409('Duplicate system users provided in assignment payload');
    }

    await Promise.all(payload.map((assignee) => this.userService.getUserById(assignee.system_user_id)));

    await Promise.all(
      payload.map(async (assignee) => {
        const existing = await this.ticketSystemUserRepository.getActiveTicketSystemUserByTicketAndSystemUser(
          ticketId,
          assignee.system_user_id
        );

        if (existing) {
          throw new HTTP409('System user is already actively assigned to this ticket');
        }
      })
    );

    return Promise.all(
      payload.map((assignee) =>
        this.ticketSystemUserRepository.insertTicketSystemUser({
          ticket_id: ticketId,
          system_user_id: assignee.system_user_id,
          status: assignee.status
        })
      )
    );
  }

  /**
   * Update assignee lifecycle status for an existing assignment.
   *
   * Behavior:
   * - verifies ticket exists
   * - verifies active assignee row exists
   * - applies status update on active row
   *
   * Note:
   * - route-level authorization enforces admin-only access for this operation.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketSystemUserId - ticket_system_user UUID.
   * @param {UpdateTicketSystemUserStatusRequest} payload - New status payload.
   * @return {Promise<TicketSystemUser>} Updated assignment row.
   * @throws {HTTP404} When ticket or assignee row is not found.
   * @memberof TicketSystemUserService
   */
  async updateTicketAssigneeStatus(
    ticketId: string,
    ticketSystemUserId: string,
    payload: UpdateTicketSystemUserStatusRequest
  ): Promise<TicketSystemUser> {
    await this.ticketRepository.getTicketById(ticketId);

    const existing = await this.ticketSystemUserRepository.getActiveTicketSystemUserById(ticketId, ticketSystemUserId);

    if (!existing) {
      throw new HTTP404('Ticket assignee not found');
    }

    return this.ticketSystemUserRepository.updateTicketSystemUserStatus(ticketId, ticketSystemUserId, {
      status: payload.status
    });
  }

  /**
   * Soft delete an assignee row for a ticket.
   *
   * Behavior:
   * - verifies ticket exists
   * - verifies active assignee row exists
   * - marks row ended via `record_end_date`
   *
   * Note:
   * - route-level authorization enforces admin-only access for this operation.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketSystemUserId - ticket_system_user UUID.
   * @return {Promise<void>}
   * @throws {HTTP404} When ticket or assignee row is not found.
   * @memberof TicketSystemUserService
   */
  async deleteTicketAssignee(ticketId: string, ticketSystemUserId: string): Promise<void> {
    await this.ticketRepository.getTicketById(ticketId);

    const existing = await this.ticketSystemUserRepository.getActiveTicketSystemUserById(ticketId, ticketSystemUserId);

    if (!existing) {
      throw new HTTP404('Ticket assignee not found');
    }

    await this.ticketSystemUserRepository.softDeleteTicketSystemUser(ticketId, ticketSystemUserId);
  }

  /**
   * Return active assignees for a ticket with nested system user details.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketSystemUserWithUser[]>} Active assignment rows with user payload.
   * @memberof TicketSystemUserService
   */
  async getActiveTicketAssignees(ticketId: string): Promise<TicketSystemUserWithUser[]> {
    return this.ticketSystemUserRepository.getActiveTicketSystemUsersByTicketId(ticketId);
  }
}
