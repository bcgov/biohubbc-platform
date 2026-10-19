import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { BaseRepository } from './base-repository';

/**
 * Repository for board_swimlane_tag table operations. Swimlanes link to board tags, never directly to tags.
 */
export class BoardSwimlaneTagRepository extends BaseRepository {
  /**
   * Link board tags to a board swimlane, skipping links that are already active and duplicate ids.
   *
   * Only active board tags of the given board are linked, so a lane can never reference another board's tags.
   *
   * @param {string} boardId - Board UUID the swimlane and board tags must belong to.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @param {string[]} boardTagIds - Board tag UUIDs to link.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneTagRepository
   */
  async insertBoardSwimlaneTags(boardId: string, boardSwimlaneId: string, boardTagIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO board_swimlane_tag (board_swimlane_id, board_tag_id)
      SELECT ${boardSwimlaneId}::uuid, bt.board_tag_id
      FROM board_tag bt
      WHERE bt.board_tag_id = ANY(${boardTagIds}::uuid[])
        AND bt.board_id = ${boardId}
        AND bt.record_end_date IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM board_swimlane_tag bst
          WHERE bst.board_swimlane_id = ${boardSwimlaneId}
            AND bst.board_tag_id = bt.board_tag_id
            AND bst.record_end_date IS NULL
        );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft delete the active board tag links of a board swimlane whose board tag is not in the given set.
   *
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @param {string[]} boardTagIds - Board tag UUIDs to keep. Empty removes every link.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneTagRepository
   */
  async deleteBoardSwimlaneTagsNotIn(boardSwimlaneId: string, boardTagIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      UPDATE board_swimlane_tag
      SET record_end_date = now()
      WHERE board_swimlane_id = ${boardSwimlaneId}
        AND board_tag_id <> ALL(${boardTagIds}::uuid[])
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft delete all active board tag links of a board swimlane.
   *
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneTagRepository
   */
  async deleteBoardSwimlaneTagsBySwimlaneId(boardSwimlaneId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_swimlane_tag')
      .update({ record_end_date: knex.fn.now() })
      .where('board_swimlane_id', boardSwimlaneId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }

  /**
   * Soft delete all active board tag links of every active swimlane on a board.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneTagRepository
   */
  async deleteBoardSwimlaneTagsByBoardId(boardId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_swimlane_tag')
      .update({ record_end_date: knex.fn.now() })
      .whereIn(
        'board_swimlane_id',
        knex('board_swimlane').select('board_swimlane_id').where('board_id', boardId).whereNull('record_end_date')
      )
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }

  /**
   * Soft delete the active swimlane links to a board's tags whose tag is not in the given set.
   *
   * Run before removing the same board tags so lanes never keep a tag the board no longer has.
   *
   * @param {string} boardId - Board UUID.
   * @param {string[]} tagIds - Tag UUIDs the board keeps. Empty removes every lane link on the board.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneTagRepository
   */
  async deleteBoardSwimlaneTagsForBoardTagsNotIn(boardId: string, tagIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      UPDATE board_swimlane_tag bst
      SET record_end_date = now()
      FROM board_tag bt
      WHERE bt.board_tag_id = bst.board_tag_id
        AND bt.board_id = ${boardId}
        AND bt.tag_id <> ALL(${tagIds}::uuid[])
        AND bt.record_end_date IS NULL
        AND bst.record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft delete all active swimlane links to any board's link of a tag.
   *
   * Run before removing the tag's board links.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneTagRepository
   */
  async deleteBoardSwimlaneTagsByTagId(tagId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE board_swimlane_tag bst
      SET record_end_date = now()
      FROM board_tag bt
      WHERE bt.board_tag_id = bst.board_tag_id
        AND bt.tag_id = ${tagId}
        AND bt.record_end_date IS NULL
        AND bst.record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }
}
