import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { TagId } from '../models/tag';
import { BaseRepository } from './base-repository';

/**
 * Repository for board_tag table operations: the tags that put tickets on a board when applied to them.
 */
export class BoardTagRepository extends BaseRepository {
  /**
   * Link tags to a board, skipping tags that are already actively linked and duplicate ids.
   *
   * @param {string} boardId - Board UUID.
   * @param {string[]} tagIds - Tag UUIDs to link.
   * @returns {Promise<TagId[]>} The tags newly linked.
   * @memberof BoardTagRepository
   */
  async insertBoardTags(boardId: string, tagIds: string[]): Promise<TagId[]> {
    const sqlStatement = SQL`
      INSERT INTO board_tag (board_id, tag_id)
      SELECT ${boardId}::uuid, requested.tag_id
      FROM (SELECT DISTINCT unnest(${tagIds}::uuid[]) AS tag_id) requested
      WHERE NOT EXISTS (
        SELECT 1
        FROM board_tag bt
        WHERE bt.board_id = ${boardId}
          AND bt.tag_id = requested.tag_id
          AND bt.record_end_date IS NULL
      )
      RETURNING tag_id;
    `;

    const response = await this.connection.sql(sqlStatement, TagId);

    return response.rows;
  }

  /**
   * Soft delete a tag's active link to a board, if any.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof BoardTagRepository
   */
  async deleteBoardTag(boardId: string, tagId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_tag')
      .update({ record_end_date: knex.fn.now() })
      .where('board_id', boardId)
      .where('tag_id', tagId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }

  /**
   * Soft delete all active tag links of a board.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @memberof BoardTagRepository
   */
  async deleteBoardTagsByBoardId(boardId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_tag')
      .update({ record_end_date: knex.fn.now() })
      .where('board_id', boardId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }

  /**
   * Soft delete all active board links of a tag.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof BoardTagRepository
   */
  async deleteBoardTagsByTagId(tagId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_tag')
      .update({ record_end_date: knex.fn.now() })
      .where('tag_id', tagId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }
}
