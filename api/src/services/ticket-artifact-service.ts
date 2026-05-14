import { IDBConnection } from '../database/db';
import { TicketArtifact } from '../models/ticket-artifact';
import { TicketArtifactFilters, TicketArtifactRepository } from '../repositories/ticket-artifact-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Service for ticket attachments.
 *
 * Attachments belong to tickets, not comments. Comments link to them with
 * `ticket_artifact_id`, while downloads still use the stored `artifact_id`.
 */
export class TicketArtifactService extends DBService {
  ticketArtifactRepository: TicketArtifactRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketArtifactRepository = new TicketArtifactRepository(connection);
  }

  /**
   * Attach artifacts to a ticket.
   *
   * If an active link already exists, the same active row is returned. Returned
   * rows include object keys so callers can show file names right away.
   *
   * @param {string} ticketId - Owning ticket UUID.
   * @param {string[]} artifactIds - Underlying artifact UUIDs to attach.
   * @returns {Promise<TicketArtifact[]>} Active ticket attachment rows for the requested artifacts.
   * @memberof TicketArtifactService
   */
  async insertTicketArtifacts(ticketId: string, artifactIds: string[]): Promise<TicketArtifact[]> {
    return this.ticketArtifactRepository.insertTicketArtifacts(ticketId, artifactIds);
  }

  /**
   * Find one active attachment for a ticket.
   *
   * Download routes use this to check that a `ticket_artifact_id` belongs to
   * the ticket before using the stored `artifact_id`.
   *
   * @param {string} ticketId - Ticket UUID from the route.
   * @param {string} ticketArtifactId - Ticket attachment UUID from markdown/download links.
   * @returns {Promise<TicketArtifact | null>} Active ticket attachment row, or null when not linked.
   * @memberof TicketArtifactService
   */
  async findTicketArtifactById(ticketId: string, ticketArtifactId: string): Promise<TicketArtifact | null> {
    return this.ticketArtifactRepository.findTicketArtifactById(ticketId, ticketArtifactId);
  }

  /**
   * List active attachments for a ticket.
   *
   * Ticket detail pages pass this list to markdown renderers so comment links
   * can be matched to ticket files.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {TicketArtifactFilters} [filters] - Optional filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination.
   * @returns {Promise<TicketArtifact[]>} Active attachments with display object keys.
   * @memberof TicketArtifactService
   */
  async getTicketArtifacts(
    ticketId: string,
    filters?: TicketArtifactFilters,
    pagination?: ApiPaginationOptions
  ): Promise<TicketArtifact[]> {
    return this.ticketArtifactRepository.getTicketArtifacts(ticketId, filters, pagination);
  }

  /**
   * Count active attachments for a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {TicketArtifactFilters} [filters] - Optional filters.
   * @returns {Promise<number>} Active attachment count.
   * @memberof TicketArtifactService
   */
  async getTicketArtifactsCount(ticketId: string, filters?: TicketArtifactFilters): Promise<number> {
    return this.ticketArtifactRepository.getTicketArtifactsCount(ticketId, filters);
  }
}
