import { IDBConnection } from '../database/db';
import { TicketStatusHistory } from '../models/ticket-status-history';
import {
  CreateTicketRequest,
  Ticket,
  TicketStatus,
  UpdateTicketRequest
} from '../models/ticket';
import { TicketRepository } from '../repositories/ticket-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

export class TicketService extends DBService {
  ticketRepository: TicketRepository;

  /**
   * Creates an instance of TicketService.
   *
   * @param {IDBConnection} connection - Database connection object.
   * @memberof TicketService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketRepository = new TicketRepository(connection);
  }

  /**
   * Create a new ticket and write its initial status history entry.
   *
   * @param {CreateTicketRequest} ticket - Ticket payload to create.
   * @return {Promise<Ticket>} The newly created ticket.
   * @memberof TicketService
   */
  async createTicket(ticket: CreateTicketRequest): Promise<Ticket> {
    const createdTicket = await this.ticketRepository.insertTicket(ticket);

    await this.ticketRepository.insertTicketStatusHistory(createdTicket.ticket_id, createdTicket.status);

    return createdTicket;
  }

  /**
   * Get a ticket by its identifier.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<Ticket>} The requested ticket.
   * @memberof TicketService
   */
  async getTicket(ticketId: string): Promise<Ticket> {
    return this.ticketRepository.getTicketById(ticketId);
  }

  /**
   * Get a ticket by its human-readable ticket number.
   *
   * @param {number} ticketNumber - Ticket number.
   * @return {Promise<Ticket>} The requested ticket.
   * @memberof TicketService
   */
  async getTicketByNumber(ticketNumber: number): Promise<Ticket> {
    return this.ticketRepository.getTicketByNumber(ticketNumber);
  }

  /**
   * List tickets for a team with an optional status filter.
   *
   * @param {string} [teamId] - Optional team UUID filter.
   * @param {TicketStatus} [status] - Optional ticket status filter.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Ticket[]>} Matching tickets.
   * @memberof TicketService
   */
  async getTicketsByTeamId(
    teamId: string | undefined,
    status: TicketStatus | undefined,
    pagination?: ApiPaginationOptions
  ): Promise<Ticket[]> {
    return this.ticketRepository.getTicketsByTeamId(teamId, status, pagination);
  }

  /**
   * Count tickets for a team with an optional status filter.
   *
   * @param {string} [teamId] - Optional team UUID filter.
   * @param {TicketStatus} [status] - Optional ticket status filter.
   * @return {Promise<number>} Total count of matching tickets.
   * @memberof TicketService
   */
  async getTicketsByTeamIdCount(teamId?: string, status?: TicketStatus): Promise<number> {
    return this.ticketRepository.getTicketsByTeamIdCount(teamId, status);
  }

  /**
   * Update ticket fields, including status when provided.
   *
   * When status changes, an immutable status history row is appended.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {UpdateTicketRequest} ticket - Partial ticket update payload.
   * @return {Promise<Ticket>} Updated ticket record.
   * @memberof TicketService
   */
  async updateTicket(ticketId: string, ticket: UpdateTicketRequest): Promise<Ticket> {
    const currentTicket = await this.ticketRepository.getTicketById(ticketId);

    if (ticket.status && currentTicket.status === ticket.status) {
      return currentTicket;
    }

    const updatedTicket = await this.ticketRepository.updateTicket(ticketId, ticket);

    if (ticket.status && currentTicket.status !== ticket.status) {
      await this.ticketRepository.insertTicketStatusHistory(ticketId, ticket.status);
    }

    return updatedTicket;
  }

  /**
   * Get status history entries for a ticket ordered newest first.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketStatusHistory[]>} Status history rows.
   * @memberof TicketService
   */
  async getTicketStatusHistory(ticketId: string): Promise<TicketStatusHistory[]> {
    return this.ticketRepository.getTicketStatusHistory(ticketId);
  }
}
