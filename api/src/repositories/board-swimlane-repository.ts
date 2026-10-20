import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { BoardSwimlane, BoardSwimlaneId, BoardSwimlanePayload } from '../models/board';
import { BaseRepository } from './base-repository';
import { activeBoardSwimlaneTagsJson } from './sql-fragments';

const BOARD_SWIMLANE_COLUMNS = `
  bs.board_swimlane_id,
  bs.board_id,
  bs.name,
  bs.description,
  bs.color,
  bs.sort_order,
  bs.is_visible,
  ${activeBoardSwimlaneTagsJson('bs.board_swimlane_id')} AS tags
`;

/**
 * Repository for board_swimlane table operations.
 */
export class BoardSwimlaneRepository extends BaseRepository {
  /**
   * Get the active swimlanes of a board with their active tags, in display order (sort_order, then id).
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<BoardSwimlane[]>} Active swimlanes of the board.
   * @memberof BoardSwimlaneRepository
   */
  async getBoardSwimlanes(boardId: string): Promise<BoardSwimlane[]> {
    const sqlStatement = SQL`
      SELECT `
      .append(BOARD_SWIMLANE_COLUMNS)
      .append(
        SQL`
      FROM board_swimlane bs
      WHERE bs.board_id = ${boardId}
        AND bs.record_end_date IS NULL
      ORDER BY bs.sort_order ASC, bs.board_swimlane_id ASC;
    `
      );

    const response = await this.connection.sql(sqlStatement, BoardSwimlane);

    return response.rows;
  }

  /**
   * Get a single active swimlane that belongs to the given board, with its active tags.
   *
   * @param {string} boardId - Board UUID the swimlane must belong to.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @returns {Promise<BoardSwimlane>} Matching swimlane.
   * @throws {ApiNotFoundError} If no active swimlane with that id exists on the board.
   * @memberof BoardSwimlaneRepository
   */
  async getBoardSwimlaneById(boardId: string, boardSwimlaneId: string): Promise<BoardSwimlane> {
    const sqlStatement = SQL`
      SELECT `
      .append(BOARD_SWIMLANE_COLUMNS)
      .append(
        SQL`
      FROM board_swimlane bs
      WHERE bs.board_swimlane_id = ${boardSwimlaneId}
        AND bs.board_id = ${boardId}
        AND bs.record_end_date IS NULL;
    `
      );

    const response = await this.connection.sql(sqlStatement, BoardSwimlane);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Board swimlane not found', [
        'BoardSwimlaneRepository->getBoardSwimlaneById',
        { boardId, boardSwimlaneId }
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find the active swimlane of a board with a case-insensitively matching name.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} name - Swimlane name.
   * @returns {Promise<BoardSwimlaneId | undefined>} Matching active swimlane identifier, if any.
   * @memberof BoardSwimlaneRepository
   */
  async findBoardSwimlaneByName(boardId: string, name: string): Promise<BoardSwimlaneId | undefined> {
    const knex = getKnex();
    const query = knex('board_swimlane')
      .select('board_swimlane_id')
      .where('board_id', boardId)
      .whereRaw('lower(name) = lower(?)', [name])
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, BoardSwimlaneId);

    return response.rows[0];
  }

  /**
   * Insert a swimlane at the end of a board (max active sort_order + 1, or 0 for the first lane).
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardSwimlanePayload} swimlane - Swimlane payload.
   * @returns {Promise<BoardSwimlaneId>} Created swimlane identifier.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof BoardSwimlaneRepository
   */
  async insertBoardSwimlane(boardId: string, swimlane: BoardSwimlanePayload): Promise<BoardSwimlaneId> {
    const sqlStatement = SQL`
      INSERT INTO board_swimlane (board_id, name, description, color, is_visible, sort_order)
      SELECT
        ${boardId}::uuid,
        ${swimlane.name}::varchar,
        ${swimlane.description}::varchar,
        ${swimlane.color}::varchar,
        ${swimlane.is_visible}::boolean,
        COALESCE(MAX(bs.sort_order) + 1, 0)
      FROM board_swimlane bs
      WHERE bs.board_id = ${boardId}
        AND bs.record_end_date IS NULL
      RETURNING board_swimlane_id;
    `;

    const response = await this.connection.sql(sqlStatement, BoardSwimlaneId);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert board swimlane', [
        'BoardSwimlaneRepository->insertBoardSwimlane',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an active swimlane that belongs to the given board.
   *
   * @param {string} boardId - Board UUID the swimlane must belong to.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @param {BoardSwimlanePayload} swimlane - Swimlane payload.
   * @returns {Promise<void>}
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof BoardSwimlaneRepository
   */
  async updateBoardSwimlane(boardId: string, boardSwimlaneId: string, swimlane: BoardSwimlanePayload): Promise<void> {
    const knex = getKnex();
    const query = knex('board_swimlane')
      .update({
        name: swimlane.name,
        description: swimlane.description,
        color: swimlane.color,
        is_visible: swimlane.is_visible
      })
      .where('board_swimlane_id', boardSwimlaneId)
      .where('board_id', boardId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update board swimlane', [
        'BoardSwimlaneRepository->updateBoardSwimlane',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }

  /**
   * Rewrite the sort_order of a board's swimlanes to 0..n-1 following the given order.
   *
   * @param {string} boardId - Board UUID the swimlanes must belong to.
   * @param {string[]} boardSwimlaneIds - Swimlane UUIDs in the desired display order.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneRepository
   */
  async updateBoardSwimlaneSortOrder(boardId: string, boardSwimlaneIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      UPDATE board_swimlane bs
      SET sort_order = ordered.position - 1
      FROM unnest(${boardSwimlaneIds}::uuid[]) WITH ORDINALITY AS ordered(board_swimlane_id, position)
      WHERE bs.board_swimlane_id = ordered.board_swimlane_id
        AND bs.board_id = ${boardId}
        AND bs.record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft delete an active swimlane that belongs to the given board.
   *
   * @param {string} boardId - Board UUID the swimlane must belong to.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @returns {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof BoardSwimlaneRepository
   */
  async deleteBoardSwimlane(boardId: string, boardSwimlaneId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_swimlane')
      .update({ record_end_date: knex.fn.now() })
      .where('board_swimlane_id', boardSwimlaneId)
      .where('board_id', boardId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete board swimlane', [
        'BoardSwimlaneRepository->deleteBoardSwimlane',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }

  /**
   * Soft delete all active swimlanes of a board.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneRepository
   */
  async deleteBoardSwimlanesByBoardId(boardId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_swimlane')
      .update({ record_end_date: knex.fn.now() })
      .where('board_id', boardId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }
}
