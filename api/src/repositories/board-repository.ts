import { Knex } from 'knex';
import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Board, BoardFilters, BoardPayload, BoardSummary, BoardTicket, BoardTicketFilters } from '../models/board';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { activeBoardTagsJson, activeTicketTagsJson } from './sql-fragments';

const BOARD_COLUMNS = ['board_id', 'name', 'description', 'create_date'] as const;

/**
 * Repository for board table operations, including computed board ticket membership.
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
   * List active boards with their active tags and active swimlane count, ordered by case-insensitive name unless a
   * sort is given.
   *
   * @param {BoardFilters} [filters] - Optional filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination and sorting.
   * @returns {Promise<BoardSummary[]>} Active boards.
   * @memberof BoardRepository
   */
  async getBoards(filters?: BoardFilters, pagination?: ApiPaginationOptions): Promise<BoardSummary[]> {
    const knex = getKnex();
    let query = knex('board')
      .select([
        ...BOARD_COLUMNS.map((column) => `board.${column}`),
        knex.raw(`${activeBoardTagsJson('board.board_id')} AS tags`),
        knex.raw(`(
          SELECT count(*)::integer
          FROM board_swimlane bs
          WHERE bs.board_id = board.board_id
            AND bs.record_end_date IS NULL
        ) AS swimlane_count`)
      ])
      .whereNull('board.record_end_date');
    query = this.applyFilters(query, filters);
    query = this.applyPagination(query, pagination);

    if (!pagination?.sort) {
      query = query.orderByRaw('lower(board.name) ASC, board.board_id ASC');
    }

    const response = await this.connection.knex(query, BoardSummary);

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

  /**
   * Get the tickets on a board, each with its placed swimlane.
   *
   * Membership: an active ticket is on the board when it has an active ticket_tag whose active tag is one of the
   * board's active board_tag rows (any match). Swimlanes only reference board tags, so they never add tickets.
   *
   * Placement: among the board's active lanes whose active tags the ticket has (any match), the ticket goes to the
   * lane with the highest sort_order (ties: the later board_swimlane_id, i.e. the furthest along in display order).
   * A null board_swimlane_id means no lane matched ("Unsorted"). Lane visibility is not applied here.
   *
   * Ordered by priority (critical first), then most recently updated.
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardTicketFilters} filters - Closed tickets are excluded unless include_closed is true.
   * @returns {Promise<BoardTicket[]>} Board tickets with tags and placed lane.
   * @memberof BoardRepository
   */
  async getBoardTickets(boardId: string, filters: BoardTicketFilters): Promise<BoardTicket[]> {
    const sqlStatement = SQL`
      WITH board_ticket AS (
        SELECT DISTINCT tt.ticket_id
        FROM board_tag bt
        JOIN tag tg
          ON tg.tag_id = bt.tag_id
          AND tg.record_end_date IS NULL
        JOIN ticket_tag tt
          ON tt.tag_id = bt.tag_id
          AND tt.record_end_date IS NULL
        JOIN ticket t
          ON t.ticket_id = tt.ticket_id
          AND t.record_end_date IS NULL
        WHERE bt.board_id = ${boardId}
          AND bt.record_end_date IS NULL
          AND (${filters.include_closed}::boolean OR t.status = 'open')
      ),
      ticket_swimlane AS (
        SELECT DISTINCT ON (tt.ticket_id)
          tt.ticket_id,
          bs.board_swimlane_id
        FROM board_ticket bti
        JOIN ticket_tag tt
          ON tt.ticket_id = bti.ticket_id
          AND tt.record_end_date IS NULL
        JOIN tag tg
          ON tg.tag_id = tt.tag_id
          AND tg.record_end_date IS NULL
        JOIN board_tag bt
          ON bt.tag_id = tt.tag_id
          AND bt.board_id = ${boardId}
          AND bt.record_end_date IS NULL
        JOIN board_swimlane_tag bst
          ON bst.board_tag_id = bt.board_tag_id
          AND bst.record_end_date IS NULL
        JOIN board_swimlane bs
          ON bs.board_swimlane_id = bst.board_swimlane_id
          AND bs.board_id = ${boardId}
          AND bs.record_end_date IS NULL
        ORDER BY tt.ticket_id, bs.sort_order DESC, bs.board_swimlane_id DESC
      )
      SELECT
        t.ticket_id,
        t.ticket_slug,
        t.subject,
        t.description,
        t.team_id,
        t.create_date,
        t.priority,
        t.status,
      `
      .append(activeTicketTagsJson('t.ticket_id'))
      .append(
        SQL` AS tags,
        ts.board_swimlane_id
      FROM board_ticket bti
      JOIN ticket t
        ON t.ticket_id = bti.ticket_id
      LEFT JOIN ticket_swimlane ts
        ON ts.ticket_id = t.ticket_id
      ORDER BY t.priority DESC, COALESCE(t.update_date, t.create_date) DESC, t.ticket_id ASC;
    `
      );

    const response = await this.connection.sql(sqlStatement, BoardTicket);

    return response.rows;
  }
}
