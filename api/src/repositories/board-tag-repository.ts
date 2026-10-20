import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { BoardTagId } from '../models/board';
import { BoardTag } from '../models/tag';
import { BaseRepository } from './base-repository';

/**
 * Repository for board_tag table operations.
 */
export class BoardTagRepository extends BaseRepository {
  /**
   * Get the active tags of a board ordered by case-insensitive name.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<BoardTag[]>} Active board tags.
   * @memberof BoardTagRepository
   */
  async getBoardTags(boardId: string): Promise<BoardTag[]> {
    const knex = getKnex();
    const query = knex('board_tag')
      .select('board_tag.board_tag_id', 'tag.tag_id', 'tag.name', 'tag.color')
      .join('tag', 'tag.tag_id', 'board_tag.tag_id')
      .where('board_tag.board_id', boardId)
      .whereNull('board_tag.record_end_date')
      .whereNull('tag.record_end_date')
      .orderByRaw('lower(tag.name) ASC, tag.tag_id ASC');

    const response = await this.connection.knex(query, BoardTag);

    return response.rows;
  }

  /**
   * Get the identifiers of the given board tags that are active and belong to the board.
   *
   * @param {string} boardId - Board UUID.
   * @param {string[]} boardTagIds - Board tag UUIDs to check.
   * @returns {Promise<BoardTagId[]>} Active board tag identifiers of the board among the input.
   * @memberof BoardTagRepository
   */
  async getActiveBoardTagIds(boardId: string, boardTagIds: string[]): Promise<BoardTagId[]> {
    const knex = getKnex();
    const query = knex('board_tag')
      .select('board_tag_id')
      .where('board_id', boardId)
      .whereIn('board_tag_id', boardTagIds)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, BoardTagId);

    return response.rows;
  }

  /**
   * Link tags to a board, skipping tags that are already actively linked and duplicate ids.
   *
   * @param {string} boardId - Board UUID.
   * @param {string[]} tagIds - Tag UUIDs to link.
   * @returns {Promise<void>}
   * @memberof BoardTagRepository
   */
  async insertBoardTags(boardId: string, tagIds: string[]): Promise<void> {
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
      );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft delete the active tag links of a board whose tag is not in the given set.
   *
   * @param {string} boardId - Board UUID.
   * @param {string[]} tagIds - Tag UUIDs to keep. Empty removes every link.
   * @returns {Promise<void>}
   * @memberof BoardTagRepository
   */
  async deleteBoardTagsNotIn(boardId: string, tagIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      UPDATE board_tag
      SET record_end_date = now()
      WHERE board_id = ${boardId}
        AND tag_id <> ALL(${tagIds}::uuid[])
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
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
