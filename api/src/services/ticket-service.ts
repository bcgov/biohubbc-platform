import { randomUUID } from 'crypto';
import { IDBConnection } from '../database/db';
import { CreateTicketRequest, Ticket, TicketStatus, TicketWithHistory, UpdateTicketRequest } from '../models/ticket';
import { TicketRepository } from '../repositories/ticket-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { TeamService } from './access-policy/team-service';
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
   * If `team_id` is omitted, a team is auto-generated and associated with the ticket.
   *
   * @param {CreateTicketRequest} ticket - Ticket payload to create.
   * @return {Promise<Ticket>} The newly created ticket.
   * @memberof TicketService
   */
  async createTicket(ticket: CreateTicketRequest): Promise<Ticket> {
    const ticketTeamId = ticket.team_id ?? (await this.createTicketTeam()).team_id;
    const createdTicket = await this.ticketRepository.insertTicket({ ...ticket, team_id: ticketTeamId });

    await this.ticketRepository.insertTicketStatusHistory(createdTicket.ticket_id, createdTicket.status);

    return createdTicket;
  }

  /**
   * Create an internal team record for ticket ownership when a team is not provided.
   *
   * @return {*} {Promise<{ team_id: string }>}
   * @memberof TicketService
   */
  private async createTicketTeam(): Promise<{ team_id: string }> {
    const teamService = new TeamService(this.connection);
    const createdTeam = await teamService.createTeam({
      name: `Ticket Team ${randomUUID()}`,
      description: 'Auto-generated team for ticket ownership.'
    });

    return { team_id: createdTeam.team_id };
  }

  /**
   * Get a ticket by its identifier.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketWithHistory>} The requested ticket including status history.
   * @memberof TicketService
   */
  async getTicket(ticketId: string): Promise<TicketWithHistory> {
    const [ticket, history] = await Promise.all([
      this.ticketRepository.getTicketById(ticketId),
      this.ticketRepository.getTicketStatusHistory(ticketId)
    ]);

    return { ...ticket, history };
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
}
