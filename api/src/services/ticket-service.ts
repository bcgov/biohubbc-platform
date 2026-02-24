import { randomInt } from 'crypto';
import { v4 } from 'uuid';
import { IDBConnection } from '../database/db';
import { HTTP400 } from '../errors/http-error';
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
    const maxShortIdAttempts = 20;
    let createdTicket: Ticket | null = null;

    for (let attempt = 0; attempt < maxShortIdAttempts; attempt++) {
      const ticketShortId = this.generateTicketShortId();

      try {
        createdTicket = await this.ticketRepository.insertTicket({
          ...ticket,
          team_id: ticketTeamId,
          ticket_short_id: ticketShortId
        });
        break;
      } catch (error: any) {
        if (error?.code === '23505' && error?.constraint === 'ticket_short_id_unique') {
          continue;
        }

        throw error;
      }
    }

    if (!createdTicket) {
      throw new Error('Failed to generate a unique ticket short ID');
    }

    await this.ticketRepository.insertTicketStatusHistory(createdTicket.ticket_id, createdTicket.status);

    return createdTicket;
  }

  /**
   * Generate an 8-digit ticket short ID in DDDNNNNN format using UTC day-of-year plus random digits.
   *
   * @return {string} The generated ticket short ID.
   * @memberof TicketService
   */
  private generateTicketShortId(): string {
    const now = new Date();
    const utcYearStart = Date.UTC(now.getUTCFullYear(), 0, 0);
    const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const dayOfYear = Math.floor((utcToday - utcYearStart) / (1000 * 60 * 60 * 24));
    const randomSequence = randomInt(0, 100000);

    return `${dayOfYear.toString().padStart(3, '0')}${randomSequence.toString().padStart(5, '0')}`;
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
   * Get a ticket by its identifier.
   *
   * @param {string} ticketRef - Ticket UUID or short ID.
   * @return {Promise<TicketWithHistory>} The requested ticket including status history.
   * @memberof TicketService
   */
  async getTicket(ticketRef: string): Promise<TicketWithHistory> {
    const resolvedTicket = await this.resolveTicketByRef(ticketRef);
    const [ticket, history] = await Promise.all([
      this.ticketRepository.getTicketById(resolvedTicket.ticket_id),
      this.ticketRepository.getTicketStatusHistory(resolvedTicket.ticket_id)
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
   * @param {string} ticketRef - Ticket UUID or short ID.
   * @param {UpdateTicketRequest} ticket - Partial ticket update payload.
   * @return {Promise<Ticket>} Updated ticket record.
   * @memberof TicketService
   */
  async updateTicket(ticketRef: string, ticket: UpdateTicketRequest): Promise<Ticket> {
    const currentTicket = await this.resolveTicketByRef(ticketRef);

    if (ticket.status && currentTicket.status === ticket.status) {
      return currentTicket;
    }

    const updatedTicket = await this.ticketRepository.updateTicket(currentTicket.ticket_id, ticket);

    if (ticket.status && currentTicket.status !== ticket.status) {
      await this.ticketRepository.insertTicketStatusHistory(currentTicket.ticket_id, ticket.status);
    }

    return updatedTicket;
  }

  /**
   * Resolve a ticket reference that may be either a UUID or an 8-digit short ID.
   *
   * @param {string} ticketRef - UUID or DDDNNNNN short identifier.
   * @return {Promise<Ticket>} Ticket matching the reference.
   * @throws {HTTP400} If the reference format is invalid.
   * @memberof TicketService
   */
  private async resolveTicketByRef(ticketRef: string): Promise<Ticket> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const shortIdRegex = /^[0-9]{8}$/;

    if (uuidRegex.test(ticketRef)) {
      return this.ticketRepository.getTicketById(ticketRef);
    }

    if (shortIdRegex.test(ticketRef)) {
      return this.ticketRepository.getTicketByShortId(ticketRef);
    }

    throw new HTTP400('Invalid ticket reference', ['Expected ticket UUID or 8-digit short ID']);
  }
}
