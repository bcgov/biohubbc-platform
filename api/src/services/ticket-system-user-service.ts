import { IDBConnection } from '../database/db';
import { HTTP403, HTTP404, HTTP409 } from '../errors/http-error';
import {
  CreateTicketSystemUserRequest,
  TicketSystemUser,
  TicketSystemUserWithUser,
  UpdateTicketSystemUserStatusRequest
} from '../models/ticket-system-user';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketSystemUserRepository } from '../repositories/ticket-system-user-repository';
import { DBService } from './db-service';
import { UserService } from './user-service';

interface TicketAssigneeActor {
  systemUserId: number;
  isSystemAdmin: boolean;
}

export class TicketSystemUserService extends DBService {
  ticketRepository: TicketRepository;
  ticketSystemUserRepository: TicketSystemUserRepository;
  userService: UserService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketRepository = new TicketRepository(connection);
    this.ticketSystemUserRepository = new TicketSystemUserRepository(connection);
    this.userService = new UserService(connection);
  }

  async createTicketAssignee(
    ticketId: string,
    payload: CreateTicketSystemUserRequest,
    actor: TicketAssigneeActor
  ): Promise<TicketSystemUser> {
    if (!actor.isSystemAdmin) {
      throw new HTTP403('Only system administrators can assign users to a ticket');
    }

    await this.ensureTicketExists(ticketId);
    await this.userService.getUserById(payload.system_user_id);

    const existing = await this.ticketSystemUserRepository.getActiveTicketSystemUserByTicketAndSystemUser(
      ticketId,
      payload.system_user_id
    );

    if (existing) {
      throw new HTTP409('System user is already actively assigned to this ticket');
    }

    return this.ticketSystemUserRepository.insertTicketSystemUser({
      ticket_id: ticketId,
      system_user_id: payload.system_user_id,
      status: payload.status
    });
  }

  async updateTicketAssigneeStatus(
    ticketId: string,
    ticketSystemUserId: string,
    payload: UpdateTicketSystemUserStatusRequest,
    actor: TicketAssigneeActor
  ): Promise<TicketSystemUser> {
    await this.ensureTicketExists(ticketId);

    const existing = await this.ticketSystemUserRepository.getActiveTicketSystemUserById(ticketId, ticketSystemUserId);

    if (!existing) {
      throw new HTTP404('Ticket assignee not found');
    }

    const isOwner = existing.system_user_id === actor.systemUserId;

    if (!actor.isSystemAdmin && !isOwner) {
      throw new HTTP403('You are not authorized to update this ticket assignee');
    }

    return this.ticketSystemUserRepository.updateTicketSystemUserStatus(ticketId, ticketSystemUserId, {
      status: payload.status
    });
  }

  async deleteTicketAssignee(ticketId: string, ticketSystemUserId: string, actor: TicketAssigneeActor): Promise<void> {
    if (!actor.isSystemAdmin) {
      throw new HTTP403('Only system administrators can remove ticket assignees');
    }

    await this.ensureTicketExists(ticketId);

    const existing = await this.ticketSystemUserRepository.getActiveTicketSystemUserById(ticketId, ticketSystemUserId);

    if (!existing) {
      throw new HTTP404('Ticket assignee not found');
    }

    await this.ticketSystemUserRepository.softDeleteTicketSystemUser(ticketId, ticketSystemUserId);
  }

  async getActiveTicketAssignees(ticketId: string): Promise<TicketSystemUserWithUser[]> {
    return this.ticketSystemUserRepository.getActiveTicketSystemUsersByTicketId(ticketId);
  }

  private async ensureTicketExists(ticketId: string): Promise<void> {
    const ticket = await this.ticketRepository.getTicketByIdOrNull(ticketId);

    if (!ticket) {
      throw new HTTP404('Ticket not found');
    }
  }
}
