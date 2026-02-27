import { IDBConnection } from '../database/db';
import { TicketStatus as TicketStatusEnum } from '../models/ticket';
import { TicketStatus } from '../models/ticket-status';
import { TicketStatusRepository } from '../repositories/ticket-status-repository';
import { DBService } from './db-service';

/**
 * Service for ticket_status operations.
 */
export class TicketStatusService extends DBService {
  ticketStatusRepository: TicketStatusRepository;

  /**
   * Creates an instance of TicketStatusService.
   *
   * @param {IDBConnection} connection - Database connection object.
   * @memberof TicketStatusService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketStatusRepository = new TicketStatusRepository(connection);
  }

  /**
   * Insert a status transition row for a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {TicketStatusEnum} status - Status value to append.
   * @return {Promise<TicketStatus>} Created status row.
   * @memberof TicketStatusService
   */
  async insertTicketStatus(ticketId: string, status: TicketStatusEnum): Promise<TicketStatus> {
    return this.ticketStatusRepository.insertTicketStatus(ticketId, status);
  }

  /**
   * Get status history for a ticket
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketStatus[]>} Status rows.
   * @memberof TicketStatusService
   */
  async getTicketStatus(ticketId: string): Promise<TicketStatus[]> {
    return this.ticketStatusRepository.getTicketStatus(ticketId);
  }
}
