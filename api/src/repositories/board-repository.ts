import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Board, BoardFilters, BoardPayload } from '../models/board';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const BOARD_COLUMNS = ['board_id', 'name', 'description', 'default_swimlane_id', 'create_date'] as const;

/**
 * Repository for board table operations.
 */
export class BoardRepository extends BaseRepository {
  /**
   * Apply board list filters to a query over `board`.
   *
   * @param {Knex.QueryBuilder} query - Query over the board table.
   * @param {BoardFilters} [filters] - `search` matches the name case-insensitively.
   * @returns {Knex.QueryBuilder} The filtered query.
   * @memberof BoardRepository
   */
  applyFilters(query: Knex.QueryBuilder, filters?: BoardFilters): Knex.QueryBuilder {
    if (filters?.search) {
      query = query.whereILike('board.name', `%${filters.search}%`);
    }

    return query;
  }

  /**
   * List active boards, ordered by case-insensitive name unless a sort is given.
   *
   * @param {BoardFilters} [filters] - Optional filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination and sorting.
   * @returns {Promise<Board[]>} Active boards.
   * @memberof BoardRepository
   */
  async getBoards(filters?: BoardFilters, pagination?: ApiPaginationOptions): Promise<Board[]> {
    const knex = getKnex();
    let query = knex('board')
      .select(BOARD_COLUMNS.map((column) => `board.${column}`))
      .whereNull('board.record_end_date');
    query = this.applyFilters(query, filters);
    query = this.applyPagination(query, pagination);

    if (!pagination?.sort) {
      query = query.orderByRaw('lower(board.name) ASC, board.board_id ASC');
    }

    const response = await this.connection.knex(query, Board);

    return response.rows;
  }

  /**
   * Count active boards matching the filters.
   *
   * @param {BoardFilters} [filters] - Optional filters.
   * @returns {Promise<number>} Number of matching boards.
   * @memberof BoardRepository
   */
  async getBoardsCount(filters?: BoardFilters): Promise<number> {
    const knex = getKnex();
    let query = knex('board').select(knex.raw('count(*)::integer as count')).whereNull('board.record_end_date');
    query = this.applyFilters(query, filters);

    const response = await this.connection.knex(query);

    return response.rows[0]?.count ?? 0;
  }

  /**
   * Get a single active board by UUID.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<Board>} Matching board.
   * @throws {ApiNotFoundError} If no matching active board exists.
   * @memberof BoardRepository
   */
  async getBoardById(boardId: string): Promise<Board> {
    const knex = getKnex();
    const query = knex('board').select(BOARD_COLUMNS).where('board_id', boardId).whereNull('record_end_date');

    const response = await this.connection.knex(query, Board);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Board not found', ['BoardRepository->getBoardById', { boardId }]);
    }

    return response.rows[0];
  }

  /**
   * Find the active board with a case-insensitively matching name.
   *
   * @param {string} name - Board name.
   * @returns {Promise<Board | undefined>} Matching active board, if any.
   * @memberof BoardRepository
   */
  async findBoardByName(name: string): Promise<Board | undefined> {
    const knex = getKnex();
    const query = knex('board')
      .select(BOARD_COLUMNS)
      .whereRaw('lower(name) = lower(?)', [name])
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, Board);

    return response.rows[0];
  }

  /**
   * Insert a board.
   *
   * @param {BoardPayload} board - Board payload.
   * @returns {Promise<Board>} Created board.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof BoardRepository
   */
  async insertBoard(board: BoardPayload): Promise<Board> {
    const knex = getKnex();
    const query = knex('board')
      .insert({
        name: board.name,
        description: board.description
      })
      .returning(BOARD_COLUMNS);

    const response = await this.connection.knex(query, Board);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert board', [
        'BoardRepository->insertBoard',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an active board.
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardPayload} board - Board payload.
   * @returns {Promise<Board>} Updated board.
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof BoardRepository
   */
  async updateBoard(boardId: string, board: BoardPayload): Promise<Board> {
    const knex = getKnex();
    const query = knex('board')
      .update({
        name: board.name,
        description: board.description
      })
      .where('board_id', boardId)
      .whereNull('record_end_date')
      .returning(BOARD_COLUMNS);

    const response = await this.connection.knex(query, Board);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update board', [
        'BoardRepository->updateBoard',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Set an active board's default lane, which tickets created on or added to the board go in, or clear it.
   *
   * @param {string} boardId - Board UUID.
   * @param {string | null} boardSwimlaneId - The board's lane, or null for none.
   * @returns {Promise<void>}
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof BoardRepository
   */
  async updateBoardDefaultSwimlane(boardId: string, boardSwimlaneId: string | null): Promise<void> {
    const knex = getKnex();
    const query = knex('board')
      .update({ default_swimlane_id: boardSwimlaneId })
      .where('board_id', boardId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update board default swimlane', [
        'BoardRepository->updateBoardDefaultSwimlane',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }

  /**
   * Soft delete an active board.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof BoardRepository
   */
  async deleteBoard(boardId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board')
      .update({ record_end_date: knex.fn.now() })
      .where('board_id', boardId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete board', [
        'BoardRepository->deleteBoard',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }
}
