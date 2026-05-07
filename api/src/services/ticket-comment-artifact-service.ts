import { IDBConnection } from '../database/db';
import { TicketCommentArtifactRepository } from '../repositories/ticket-comment-artifact-repository';
import { DBService } from './db-service';

/**
 * Service for ticket comment artifact references.
 */
export class TicketCommentArtifactService extends DBService {
  ticketCommentArtifactRepository: TicketCommentArtifactRepository;

  /**
   * Creates an instance of TicketCommentArtifactService.
   *
   * @param {IDBConnection} connection - Database connection object.
   * @memberof TicketCommentArtifactService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketCommentArtifactRepository = new TicketCommentArtifactRepository(connection);
  }

  /**
   * Soft delete all active artifact references for a ticket comment.
   *
   * @param {string} ticketCommentId - Ticket comment UUID.
   * @return {Promise<void>}
   * @memberof TicketCommentArtifactService
   */
  async deleteTicketCommentArtifacts(ticketCommentId: string): Promise<void> {
    await this.ticketCommentArtifactRepository.deleteTicketCommentArtifacts(ticketCommentId);
  }

  /**
   * Replace active artifact references for a ticket comment.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketCommentId - Ticket comment UUID.
   * @param {string[]} ticketArtifactIds - Parsed ticket artifact UUIDs.
   * @return {Promise<void>}
   * @memberof TicketCommentArtifactService
   */
  async replaceTicketCommentArtifacts(
    ticketId: string,
    ticketCommentId: string,
    ticketArtifactIds: string[]
  ): Promise<void> {
    await this.ticketCommentArtifactRepository.replaceTicketCommentArtifacts(
      ticketId,
      ticketCommentId,
      ticketArtifactIds
    );
  }
}
