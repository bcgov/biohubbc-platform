import { v4 } from 'uuid';
import { IDBConnection } from '../database/db';
import { CreateTicketRequest, TeamFilters, Ticket, TicketWithHistory, UpdateTicketRequest } from '../models/ticket';
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
    let teamId = ticket.team_id;
    if (!teamId) {
      const team = await this.createTicketTeam();
      teamId = team.team_id;
    }

    const ticketSlug = await this.ticketRepository.getNextTicketSlug();
    const createdTicket = await this.ticketRepository.insertTicket({
      ...ticket,
      team_id: teamId,
      ticket_slug: ticketSlug
    });

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
    const createdTeam = await teamService.createTeamWithMembers(
      {
        name: `Ticket Team ${v4()}`,
        description: 'Auto-generated team for ticket ownership.'
      },
      []
    );

    return { team_id: createdTeam.team_id };
  }

  /**
   * Get a ticket by its UUID.
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
   * List tickets for a team with an optional status filter.
   *
   * @param {string} teamId - Team UUID filter. Pass an empty string to query all teams.
   * @param {TeamFilters} [filters] - Optional ticket list filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Ticket[]>} Matching tickets.
   * @memberof TicketService
   */
  async getTicketsByTeamId(
    teamId: string,
    filters?: TeamFilters,
    pagination?: ApiPaginationOptions
  ): Promise<Ticket[]> {
    return this.ticketRepository.getTicketsByTeamId(teamId, filters, pagination);
  }

  /**
   * Count tickets for a team with an optional status filter.
   *
   * @param {string} teamId - Team UUID filter. Pass an empty string to query all teams.
   * @param {TeamFilters} [filters] - Optional ticket list filters.
   * @return {Promise<number>} Total count of matching tickets.
   * @memberof TicketService
   */
  async getTicketsByTeamIdCount(teamId: string, filters?: TeamFilters): Promise<number> {
    return this.ticketRepository.getTicketsByTeamIdCount(teamId, filters);
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

    const updatedTicket = await this.ticketRepository.updateTicket(currentTicket.ticket_id, ticket);

    if (ticket.status && currentTicket.status !== ticket.status) {
      await this.ticketRepository.insertTicketStatusHistory(currentTicket.ticket_id, ticket.status);
    }

    return updatedTicket;
  }
}
