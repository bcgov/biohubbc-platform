import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Comment } from '../models/comment';
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
   * Find all comments associated with a data request status.
   *
   * @param {string} dataRequestStatusId
   * @return {Promise<Comment[]>}
   * @memberof CommentRepository
   */
  async findCommentsByDataRequestStatusId(dataRequestStatusId: string): Promise<Comment[]> {
    const knex = getKnex();
    const query = knex('comment as c')
      .select('c.comment_id', 'c.comment')
      .join('data_request_status as drs', 'c.comment_id', 'drs.comment_id')
      .where('drs.data_request_status_id', dataRequestStatusId);

    const response = await this.connection.knex(query, Comment);
    return response.rows;
  }

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
