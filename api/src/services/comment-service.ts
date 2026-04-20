import { IDBConnection } from '../database/db';
import { Comment } from '../models/comment';
import { CommentRepository } from '../repositories/comment-repository';
import { DBService } from './db-service';

export class CommentService extends DBService {
  commentRepository: CommentRepository;

  /**
   * Creates an instance of CommentService.
   *
   * @param {IDBConnection} connection - Database connection object.
   * @memberof CommentService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.commentRepository = new CommentRepository(connection);
  }

  /**
   * Create a new comment.
   *
   * @param {string} comment - Comment text.
   * @return {Promise<Comment>} The newly created comment row.
   * @memberof CommentService
   */
  async createComment(comment: string): Promise<Comment> {
    return this.commentRepository.createComment(comment);
  }
}
