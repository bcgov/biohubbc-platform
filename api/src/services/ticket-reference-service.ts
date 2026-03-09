import { IDBConnection } from '../database/db';
import { CreateTicketReference, TicketReference } from '../models/ticket-reference';
import { TicketReferenceRepository } from '../repositories/ticket-reference-repository';
import { DBService } from './db-service';

/**
 * Service for ticket_reference operations.
 */
export class TicketReferenceService extends DBService {
  ticketReferenceRepository: TicketReferenceRepository;

  /**
   * Creates an instance of TicketReferenceService.
   *
   * @param {IDBConnection} connection - Database connection object.
   * @memberof TicketReferenceService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketReferenceRepository = new TicketReferenceRepository(connection);
  }

  /**
   * Create a ticket reference row.
   *
   * Performs insert-then-get so the returned object matches the read shape.
   *
   * @param {CreateTicketReference} payload - Ticket reference payload.
   * @return {Promise<TicketReference>} Created ticket reference row.
   * @memberof TicketReferenceService
   */
  async createTicketReference(payload: CreateTicketReference): Promise<TicketReference> {
    const inserted = await this.ticketReferenceRepository.insertTicketReference(payload);

    return this.ticketReferenceRepository.getTicketReferenceById(inserted.ticket_reference_id);
  }

  /**
   * Soft delete a ticket reference row scoped to a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketReferenceId - Ticket reference UUID.
   * @return {Promise<void>}
   * @memberof TicketReferenceService
   */
  async deleteTicketReference(ticketId: string, ticketReferenceId: string): Promise<void> {
    await this.ticketReferenceRepository.deleteTicketReference(ticketId, ticketReferenceId);
  }

  /**
   * Get active references for a ticket where it is either source or target.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketReference[]>} Ticket reference rows.
   * @memberof TicketReferenceService
   */
  async getTicketReferencesForTicket(ticketId: string): Promise<TicketReference[]> {
    return this.ticketReferenceRepository.getTicketReferencesForTicket(ticketId);
  }
}
