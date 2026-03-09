import { IDBConnection } from '../database/db';
import { CreateTicketComment, TicketComment, UpdateTicketComment } from '../models/ticket-comment';
import { CommentRepository } from '../repositories/comment-repository';
import { TicketCommentRepository } from '../repositories/ticket-comment-repository';
import { DBService } from './db-service';

/**
 * Service for ticket_comment operations.
 */
export class TicketCommentService extends DBService {
  commentRepository: CommentRepository;
  ticketCommentRepository: TicketCommentRepository;

  /**
   * Creates an instance of TicketCommentService.
   *
   * @param {IDBConnection} connection - Database connection object.
   * @memberof TicketCommentService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.commentRepository = new CommentRepository(connection);
    this.ticketCommentRepository = new TicketCommentRepository(connection);
  }

  /**
   * Create a comment record and link it to a ticket.
   *
   * Performs insert-then-get so the returned object matches the read shape.
   *
   * @param {CreateTicketComment} payload - Ticket comment payload.
   * @return {Promise<TicketComment>} The created ticket comment row.
   * @memberof TicketCommentService
   */
  async createTicketComment(payload: CreateTicketComment): Promise<TicketComment> {
    const comment = await this.commentRepository.createComment(payload.comment);
    const insertedTicketComment = await this.ticketCommentRepository.insertTicketComment(
      payload.ticketId,
      comment.comment_id
    );
    return this.ticketCommentRepository.getTicketCommentById(payload.ticketId, insertedTicketComment.ticket_comment_id);
  }

  /**
   * Soft delete a ticket comment link row.
   *
   * @param {string} ticketCommentId - Ticket comment UUID.
   * @return {Promise<void>}
   * @memberof TicketCommentService
   */
  async deleteTicketComment(ticketId: string, ticketCommentId: string): Promise<void> {
    await this.ticketCommentRepository.deleteTicketComment(ticketId, ticketCommentId);
  }

  /**
   * Update a ticket comment body.
   *
   * @param {UpdateTicketComment} payload
   * @return {Promise<TicketComment>}
   * @memberof TicketCommentService
   */
  async updateTicketComment(payload: UpdateTicketComment): Promise<TicketComment> {
    await this.ticketCommentRepository.updateTicketComment(payload.ticketId, payload.ticketCommentId, payload.comment);

    return this.ticketCommentRepository.getTicketCommentById(payload.ticketId, payload.ticketCommentId);
  }

  /**
   * Soft delete a ticket comment link row scoped to a ticket.
   *
   * @param {string} ticketId
   * @param {string} ticketCommentId
   * @return {Promise<void>}
   * @memberof TicketCommentService
   */
  async deleteTicketCommentByTicketId(ticketId: string, ticketCommentId: string): Promise<void> {
    await this.ticketCommentRepository.getTicketCommentById(ticketId, ticketCommentId);
    await this.ticketCommentRepository.deleteTicketComment(ticketId, ticketCommentId);
  }

  /**
   * Get comment rows for a ticket ordered oldest first.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketComment[]>} Ticket comment rows.
   * @memberof TicketCommentService
   */
  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    return this.ticketCommentRepository.getTicketComments(ticketId);
  }
}
