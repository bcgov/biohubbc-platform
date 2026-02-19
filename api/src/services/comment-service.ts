import { IDBConnection } from '../database/db';
import { Comment } from '../models/comment';
import { CommentRepository } from '../repositories/comment-repository';
import { DataRequestStatusRepository } from '../repositories/data-request-status-repository';
import { DBService } from './db-service';

/**
 * Service for managing comments.
 */
export class CommentService extends DBService {
  commentRepository: CommentRepository;
  dataRequestStatusRepository: DataRequestStatusRepository;

  /**
   * Initializes the CommentService with a database connection.
   *
   * @param {IDBConnection} connection
   * @memberof CommentService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.commentRepository = new CommentRepository(connection);
    this.dataRequestStatusRepository = new DataRequestStatusRepository(connection);
  }

  /**
   * Find all comments associated with a data request status.
   *
   * @param {string} dataRequestStatusId
   * @return {Promise<Comment[]>}
   * @memberof CommentService
   */
  async findCommentsByDataRequestStatusId(dataRequestStatusId: string): Promise<Comment[]> {
    const comments = await this.commentRepository.findCommentsByDataRequestStatusId(dataRequestStatusId);
    return comments;
  }

  /**
   * Create a comment and link it to a data request status record.
   *
   * @param {string} comment
   * @param {string} dataRequestStatusId
   * @return {Promise<Comment>}
   * @memberof CommentService
   */
  async createCommentForDataRequestStatus(comment: string, dataRequestStatusId: string): Promise<Comment> {
    const newComment = await this.commentRepository.createComment(comment);

    await this.dataRequestStatusRepository.updateDataRequestStatus(dataRequestStatusId, {
      comment_id: newComment.comment_id
    });

    return newComment;
  }
}
