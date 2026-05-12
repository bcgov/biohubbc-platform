import { v4 } from 'uuid';
import { IDBConnection } from '../database/db';
import { HTTP400 } from '../errors/http-error';
import { PolicyStatus } from '../models/policy';
import { Team } from '../models/team';
import { CreateTicketRequest, Ticket, TicketFilters, TicketWithHistory, UpdateTicketRequest } from '../models/ticket';
import { CreateTicketReferenceRequest, TicketReference } from '../models/ticket-reference';
import { TicketRepository } from '../repositories/ticket-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { TeamService } from './access-policy/team-service';
import { DataRequestService } from './data-request-service';
import { DBService } from './db-service';
import { TicketArtifactService } from './ticket-artifact-service';
import { TicketCommentService } from './ticket-comment-service';
import { TicketReferenceService } from './ticket-reference-service';
import { TicketStatusService } from './ticket-status-service';
import { TicketSystemUserService } from './ticket-system-user-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

export class TicketService extends DBService {
  teamService: TeamService;
  ticketRepository: TicketRepository;
  ticketArtifactService: TicketArtifactService;
  ticketCommentService: TicketCommentService;
  ticketStatusService: TicketStatusService;
  ticketReferenceService: TicketReferenceService;
  dataRequestService: DataRequestService;
  ticketSystemUserService: TicketSystemUserService;
  submissionUploadService: SubmissionUploadService;

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
    this.ticketArtifactService = new TicketArtifactService(connection);
    this.ticketCommentService = new TicketCommentService(connection);
    this.ticketStatusService = new TicketStatusService(connection);
    this.ticketReferenceService = new TicketReferenceService(connection);
    this.dataRequestService = new DataRequestService(connection);
    this.ticketSystemUserService = new TicketSystemUserService(connection);
    this.submissionUploadService = new SubmissionUploadService(connection);
  }

  /**
   * Create a new ticket and write its initial status entry.
   *
   * @param {CreateTicketRequest} ticket - Ticket payload to create.
   * @returns {Promise<Ticket>} The newly created ticket.
   * @memberof TicketService
   */
  async createTicket(ticket: CreateTicketRequest): Promise<Ticket> {
    const { systemUserIds, ...ticketData } = ticket;

    // Ticket creation always provisions a dedicated ticket team plus a unique ticket slug.
    const [team, slug] = await Promise.all([
      this.createTicketTeam({ systemUserIds: systemUserIds ?? [] }),
      this.ticketRepository.getNextTicketSlug()
    ]);

    const createdTicket = await this.ticketRepository.insertTicket({
      ...ticketData,
      team_id: team.team_id,
      ticket_slug: slug
    });

    // Initialize status history with the ticket's initial status.
    await this.ticketStatusService.insertTicketStatus(createdTicket.ticket_id, createdTicket.status);

    return createdTicket;
  }

  /**
   * Create an internal team record for ticket ownership.
   *
   * @param {{ systemUserIds: number[] }} params - System user IDs to add as initial team members.
   * @returns {Promise<Team>} Created ticket ownership team.
   * @memberof TicketService
   */
  private async createTicketTeam({ systemUserIds }: { systemUserIds: number[] }): Promise<Team> {
    // Ticket team membership is explicit input from ticket creation only.
    // Data-request flows intentionally do not backfill requester identifiers onto ticket teams.
    const team = await this.teamService.createTeam({
      name: `Ticket Team ${v4()}`,
      description: 'Auto-generated team for ticket system users.',
      system_user_ids: systemUserIds
    });

    return team;
  }

  /**
   * Get a ticket by its UUID with related history and assignment collections.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<TicketWithHistory>} Ticket core fields with status log, comments, artifacts, references, data requests, and ticket system users.
   * @memberof TicketService
   */
  async getTicket(ticketId: string): Promise<TicketWithHistory> {
    // Read all timeline/relationship collections in parallel to keep detail view latency predictable.
    const [ticket, statuses, comments, artifacts, references, dataRequests, submissionUploads, ticketSystemUsers] =
      await Promise.all([
        this.ticketRepository.getTicketById(ticketId),
        this.ticketStatusService.getTicketStatus(ticketId),
        this.ticketCommentService.getTicketComments(ticketId),
        this.ticketArtifactService.getTicketArtifacts(ticketId),
        this.ticketReferenceService.getTicketReferencesForTicket(ticketId),
        this.dataRequestService.findDataRequestsByTicketId(ticketId),
        this.submissionUploadService.findSubmissionUploadsByTicketId(ticketId),
        this.ticketSystemUserService.getActiveTicketSystemUsersByTicketId(ticketId)
      ]);

    return {
      ...ticket,
      statuses,
      comments,
      artifacts,
      references,
      data_requests: dataRequests,
      submission_uploads: submissionUploads,
      ticket_system_users: ticketSystemUsers
    };
  }

  /**
   * Add references linking this ticket to one or more target tickets.
   *
   * @param {string} ticketId - Source ticket UUID.
   * @param {CreateTicketReferenceRequest} payload - Ticket reference payload.
   * @returns {Promise<TicketReference[]>} Created ticket references.
   * @memberof TicketService
   */
  async createTicketReference(ticketId: string, payload: CreateTicketReferenceRequest): Promise<TicketReference[]> {
    return Promise.all(
      payload.references.map((reference) =>
        this.ticketReferenceService.createTicketReference({
          source_ticket_id: ticketId,
          target_ticket_id: reference.target_ticket_id,
          relationship: reference.relationship
        })
      )
    );
  }

  /**
   * Delete a ticket reference by identifier.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketReferenceId - Ticket reference UUID.
   * @returns {Promise<void>}
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
   * @returns {Promise<Ticket[]>} Matching tickets.
   * @memberof TicketService
   */
  async getTickets(filters?: TicketFilters, pagination?: ApiPaginationOptions): Promise<Ticket[]> {
    return this.ticketRepository.getTickets(filters, pagination);
  }

  /**
   * Count tickets with optional filters.
   *
   * @param {TicketFilters} [filters] - Optional ticket list filters.
   * @returns {Promise<number>} Total count of matching tickets.
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
   * @returns {Promise<Ticket>} Updated ticket record.
   * @memberof TicketService
   */
  async updateTicket(ticketId: string, ticket: UpdateTicketRequest): Promise<Ticket> {
    // Closing is gated by linked data-request workflow state.
    if (ticket.status === 'closed') {
      const dataRequests = await this.dataRequestService.findDataRequestsByTicketId(ticketId);
      this.assertCanCloseTicket(dataRequests.map((dataRequest) => dataRequest.status));
    }

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

    // Record every explicit status change in status history.
    if (ticket.status !== undefined) {
      await this.ticketStatusService.insertTicketStatus(ticketId, ticket.status);
    }

    return updatedTicket;
  }

  /**
   * Assert that a ticket can be closed based on linked data-request statuses.
   *
   * @private
   * @param {PolicyStatus[]} dataRequestStatuses - Linked statuses.
   * @returns {void}
   * @memberof TicketService
   */
  private assertCanCloseTicket(dataRequestStatuses: PolicyStatus[]): void {
    // Tickets can only be closed once linked requests are fully resolved.
    // requested and reviewed are treated as "unaddressed".
    const blockedStatuses = new Set(['requested', 'reviewed']);
    const hasBlockedStatuses = dataRequestStatuses.some((status) => blockedStatuses.has(status));

    if (hasBlockedStatuses) {
      throw new HTTP400('Cannot close tickets that have unaddressed data requests');
    }
  }

  /**
   * Soft delete an active ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<void>}
   * @memberof TicketService
   */
  async deleteTicket(ticketId: string): Promise<void> {
    // Delete uses the same "unaddressed request" gate as close.
    const dataRequests = await this.dataRequestService.findDataRequestsByTicketId(ticketId);
    this.assertCanDeleteTicket(dataRequests.map((dataRequest) => dataRequest.status));

    await this.ticketRepository.deleteTicket(ticketId);
  }

  /**
   * Assert that a ticket can be deleted based on linked data-request statuses.
   *
   * @private
   * @param {PolicyStatus[]} dataRequestStatuses - Linked statuses.
   * @returns {void}
   * @memberof TicketService
   */
  private assertCanDeleteTicket(dataRequestStatuses: PolicyStatus[]): void {
    // Prevent deletion while linked requests are still in progress.
    const blockedStatuses = new Set(['requested', 'reviewed']);
    const hasBlockedStatuses = dataRequestStatuses.some((status) => blockedStatuses.has(status));

    if (hasBlockedStatuses) {
      throw new HTTP400('Cannot delete tickets that have unaddressed data requests');
    }
  }
}
