import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Comment } from '../models/data-request';
import { BaseRepository } from './base-repository';

/**
 * Comment repository class.
 *
 * @export
 * @class CommentRepository
 * @extends {BaseRepository}
 */
export class CommentRepository extends BaseRepository {
  /**
   * Create a new comment.
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
      throw new ApiExecuteSQLError('Failed to create comment', [
        'DataRequestRepository->createComment',
        'rowCount !== 1'
      ]);
    }
    return response.rows[0];
  }
}
