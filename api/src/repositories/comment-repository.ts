import { getKnex, IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Comment, UpdateComment } from '../models/comment';
import { BaseRepository } from './base-repository';

/**
 * Repository for `comment` table operations.
 *
 * @export
 * @class CommentRepository
 * @extends {BaseRepository}
 */
export class CommentRepository extends BaseRepository {
  /**
   * Creates an instance of CommentRepository.
   *
   * @param {IDBConnection} connection
   * @memberof CommentRepository
   */
  constructor(connection: IDBConnection) {
    super(connection);
  }

  /**
   * Create a new comment row.
   *
   * @param {string} comment
   * @return {Promise<Comment>}
   * @memberof CommentRepository
   */
  async createComment(comment: string): Promise<Comment> {
    const knex = getKnex();
    const query = knex('comment').insert({ comment }).returning(['comment', 'comment_id']);

    const response = await this.connection.knex(query, Comment);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create comment', ['CommentRepository->createComment', 'rowCount !== 1']);
    }
    return response.rows[0];
  }

  /**
   * Update an existing comment row.
   *
   * @param {string} commentId
   * @param {UpdateComment} payload
   * @return {Promise<Comment>}
   * @memberof CommentRepository
   */
  async updateComment(commentId: string, payload: UpdateComment): Promise<Comment> {
    const knex = getKnex();
    const query = knex('comment')
      .update({ comment: payload.comment })
      .where('comment_id', commentId)
      .returning(['comment', 'comment_id']);

    const response = await this.connection.knex(query, Comment);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update comment', ['CommentRepository->updateComment', 'rowCount !== 1']);
    }

    return response.rows[0];
  }
}
