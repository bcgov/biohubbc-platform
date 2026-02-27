import { v4 } from 'uuid';
import { IDBConnection } from '../database/db';
import { HTTP400 } from '../errors/http-error';
import { Team } from '../models/team';
import { CreateTicketRequest, Ticket, TicketFilters, TicketWithHistory, UpdateTicketRequest } from '../models/ticket';
import { CreateTicketReferenceRequest, TicketReference } from '../models/ticket-reference';
import { TicketCommentRepository } from '../repositories/ticket-comment-repository';
import { TicketRepository } from '../repositories/ticket-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { TeamService } from './access-policy/team-service';
import { DBService } from './db-service';
import { TicketReferenceService } from './ticket-reference-service';
import { TicketStatusService } from './ticket-status-service';

export class TicketService extends DBService {
  teamService: TeamService;
  ticketRepository: TicketRepository;
  ticketCommentRepository: TicketCommentRepository;
  ticketStatusService: TicketStatusService;
  ticketReferenceService: TicketReferenceService;

  /**
   * Creates an instance of TicketService.
   *
   * @param {IDBConnection} connection - Database connection object.
   * @memberof TicketService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.teamService = new TeamService(connection);
    this.ticketRepository = new TicketRepository(connection);
    this.ticketCommentRepository = new TicketCommentRepository(connection);
    this.ticketStatusService = new TicketStatusService(connection);
    this.ticketReferenceService = new TicketReferenceService(connection);
  }

  /**
   * Create a new ticket and write its initial status history entry.
   *
   * @param {CreateTicketRequest} ticket - Ticket payload to create.
   * @return {Promise<Ticket>} The newly created ticket.
   * @memberof TicketService
   */
  async createTicket(ticket: CreateTicketRequest): Promise<Ticket> {
    const [team, slug] = await Promise.all([this.createTicketTeam(), this.ticketRepository.getNextTicketSlug()]);

    const createdTicket = await this.ticketRepository.insertTicket({
      ...ticket,
      team_id: team.team_id,
      ticket_slug: slug
    });

    await this.ticketStatusService.insertTicketStatus(createdTicket.ticket_id, createdTicket.status);

    return createdTicket;
  }

  /**
   * Create an internal team record for ticket ownership.
   *
   * @return {*} {Promise<Team>}
   * @memberof TicketService
   */
  private async createTicketTeam(): Promise<Team> {
    const team = await this.teamService.createTeam({
      name: `Ticket Team ${v4()}`,
      description: 'Auto-generated team for ticket assignees.',
      system_user_ids: []
    });

    return team;
  }

  /**
   * Get a ticket by its UUID with separate status and comment logs.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketWithHistory>} The requested ticket including status and comment logs.
   * @memberof TicketService
   */
  async getTicket(ticketId: string): Promise<TicketWithHistory> {
    const [ticket, status_history, comments, references] = await Promise.all([
      this.ticketRepository.getTicketById(ticketId),
      this.ticketStatusService.getTicketStatus(ticketId),
      this.ticketCommentRepository.getTicketComments(ticketId),
      this.ticketReferenceService.getTicketReferencesForTicket(ticketId)
    ]);

    return { ...ticket, status_history, comments, references };
  }

  /**
   * Add a reference linking this ticket to another ticket.
   *
   * @param {string} ticketId - Source ticket UUID.
   * @param {CreateTicketReferenceRequest} payload - Ticket reference payload.
   * @return {Promise<TicketReference>} Created ticket reference.
   * @memberof TicketService
   */
  async createTicketReference(ticketId: string, payload: CreateTicketReferenceRequest): Promise<TicketReference> {
    return this.ticketReferenceService.createTicketReference({
      source_ticket_id: ticketId,
      target_ticket_id: payload.target_ticket_id,
      relationship: payload.relationship
    });
  }

  /**
   * Delete a ticket reference by identifier.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketReferenceId - Ticket reference UUID.
   * @return {Promise<void>}
   * @memberof TicketService
   */
  async deleteTicketReference(ticketId: string, ticketReferenceId: string): Promise<void> {
    await this.ticketReferenceService.deleteTicketReference(ticketId, ticketReferenceId);
  }

  /**
   * List tickets with optional filters.
   *
   * @param {TicketFilters} [filters] - Optional ticket list filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Ticket[]>} Matching tickets.
   * @memberof TicketService
   */
  async getTickets(filters?: TicketFilters, pagination?: ApiPaginationOptions): Promise<Ticket[]> {
    return this.ticketRepository.getTickets(filters, pagination);
  }

  /**
   * Count tickets with optional filters.
   *
   * @param {TicketFilters} [filters] - Optional ticket list filters.
   * @return {Promise<number>} Total count of matching tickets.
   * @memberof TicketService
   */
  async getTicketsCount(filters?: TicketFilters): Promise<number> {
    return this.ticketRepository.getTicketsCount(filters);
  }

  /**
   * Update ticket fields, including status when provided.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {UpdateTicketRequest} ticket - Partial ticket update payload.
   * @return {Promise<Ticket>} Updated ticket record.
   * @memberof TicketService
   */
  async updateTicket(ticketId: string, ticket: UpdateTicketRequest): Promise<Ticket> {
    const updates = Object.fromEntries(
      Object.entries({
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status
      }).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      throw new HTTP400('No fields provided for update');
    }

    const updatedTicket = await this.ticketRepository.updateTicket(ticketId, updates);

    if (ticket.status !== undefined) {
      await this.ticketStatusService.insertTicketStatus(ticketId, ticket.status);
    }

    return updatedTicket;
  }

  /**
   * Soft delete an active ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<void>}
   * @memberof TicketService
   */
  async deleteTicket(ticketId: string): Promise<void> {
    await this.ticketRepository.deleteTicket(ticketId);
  }
}
