import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import { BoardSwimlane, BoardSwimlaneRequest } from '../models/board';
import { BoardRepository } from '../repositories/board-repository';
import { BoardSwimlaneRepository } from '../repositories/board-swimlane-repository';
import { BoardSwimlaneTagRepository } from '../repositories/board-swimlane-tag-repository';
import { BoardTagRepository } from '../repositories/board-tag-repository';
import { getUnique } from '../utils/unique';
import { DBService } from './db-service';

/**
 * Service for admin-only board swimlanes. Every operation is scoped to the owning board.
 */
export class BoardSwimlaneService extends DBService {
  boardRepository: BoardRepository;
  boardSwimlaneRepository: BoardSwimlaneRepository;
  boardSwimlaneTagRepository: BoardSwimlaneTagRepository;
  boardTagRepository: BoardTagRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.boardRepository = new BoardRepository(connection);
    this.boardSwimlaneRepository = new BoardSwimlaneRepository(connection);
    this.boardSwimlaneTagRepository = new BoardSwimlaneTagRepository(connection);
    this.boardTagRepository = new BoardTagRepository(connection);
  }

  /**
   * Get the active swimlanes of a board in display order.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<BoardSwimlane[]>} Active swimlanes with their tags.
   * @memberof BoardSwimlaneService
   */
  async getBoardSwimlanes(boardId: string): Promise<BoardSwimlane[]> {
    return this.boardSwimlaneRepository.getBoardSwimlanes(boardId);
  }

  /**
   * Create a swimlane at the end of a board.
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardSwimlaneRequest} swimlane - Swimlane payload.
   * @returns {Promise<BoardSwimlane>} Created swimlane with its tags.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @throws {ApiConflictError} If an active lane on the board already has the same name (case-insensitive).
   * @throws {HTTP400} If any board tag is unknown, deleted, or belongs to another board.
   * @memberof BoardSwimlaneService
   */
  async createBoardSwimlane(boardId: string, swimlane: BoardSwimlaneRequest): Promise<BoardSwimlane> {
    await this.boardRepository.getBoardById(boardId);
    await this.assertBoardSwimlaneNameAvailable(boardId, swimlane.name);
    await this.assertBoardTagIds(boardId, swimlane.boardTagIds);

    const created = await this.boardSwimlaneRepository.insertBoardSwimlane(boardId, {
      name: swimlane.name,
      description: swimlane.description,
      color: swimlane.color,
      is_visible: swimlane.isVisible
    });

    await this.boardSwimlaneTagRepository.insertBoardSwimlaneTags(
      boardId,
      created.board_swimlane_id,
      swimlane.boardTagIds
    );

    return this.boardSwimlaneRepository.getBoardSwimlaneById(boardId, created.board_swimlane_id);
  }

  /**
   * Update a swimlane and replace its board tag set.
   *
   * @param {string} boardId - Board UUID the swimlane must belong to.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @param {BoardSwimlaneRequest} swimlane - Swimlane payload.
   * @returns {Promise<BoardSwimlane>} Updated swimlane with its tags.
   * @throws {ApiNotFoundError} If the swimlane does not exist on the board.
   * @throws {ApiConflictError} If another active lane on the board already has the new name (case-insensitive).
   * @throws {HTTP400} If any board tag is unknown, deleted, or belongs to another board.
   * @memberof BoardSwimlaneService
   */
  async updateBoardSwimlane(
    boardId: string,
    boardSwimlaneId: string,
    swimlane: BoardSwimlaneRequest
  ): Promise<BoardSwimlane> {
    await this.boardSwimlaneRepository.getBoardSwimlaneById(boardId, boardSwimlaneId);
    await this.assertBoardSwimlaneNameAvailable(boardId, swimlane.name, boardSwimlaneId);
    await this.assertBoardTagIds(boardId, swimlane.boardTagIds);

    await this.boardSwimlaneRepository.updateBoardSwimlane(boardId, boardSwimlaneId, {
      name: swimlane.name,
      description: swimlane.description,
      color: swimlane.color,
      is_visible: swimlane.isVisible
    });

    await this.boardSwimlaneTagRepository.deleteBoardSwimlaneTagsNotIn(boardSwimlaneId, swimlane.boardTagIds);
    await this.boardSwimlaneTagRepository.insertBoardSwimlaneTags(boardId, boardSwimlaneId, swimlane.boardTagIds);

    return this.boardSwimlaneRepository.getBoardSwimlaneById(boardId, boardSwimlaneId);
  }

  /**
   * Soft delete a swimlane and its tag links.
   *
   * @param {string} boardId - Board UUID the swimlane must belong to.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the swimlane does not exist on the board.
   * @memberof BoardSwimlaneService
   */
  async deleteBoardSwimlane(boardId: string, boardSwimlaneId: string): Promise<void> {
    await this.boardSwimlaneRepository.getBoardSwimlaneById(boardId, boardSwimlaneId);

    await this.boardSwimlaneTagRepository.deleteBoardSwimlaneTagsBySwimlaneId(boardSwimlaneId);
    await this.boardSwimlaneRepository.deleteBoardSwimlane(boardId, boardSwimlaneId);
  }

  /**
   * Soft delete every swimlane of a board and their tag links.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneService
   */
  async deleteBoardSwimlanesByBoardId(boardId: string): Promise<void> {
    await this.boardSwimlaneTagRepository.deleteBoardSwimlaneTagsByBoardId(boardId);
    await this.boardSwimlaneRepository.deleteBoardSwimlanesByBoardId(boardId);
  }

  /**
   * Reorder a board's swimlanes, rewriting sort_order to 0..n-1.
   *
   * @param {string} boardId - Board UUID.
   * @param {string[]} boardSwimlaneIds - Every active swimlane of the board, exactly once, in display order.
   * @returns {Promise<BoardSwimlane[]>} The board's swimlanes in their new order.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @throws {HTTP400} If the ids are not exactly the board's active swimlanes.
   * @memberof BoardSwimlaneService
   */
  async reorderBoardSwimlanes(boardId: string, boardSwimlaneIds: string[]): Promise<BoardSwimlane[]> {
    await this.boardRepository.getBoardById(boardId);

    const currentSwimlanes = await this.boardSwimlaneRepository.getBoardSwimlanes(boardId);
    const swimlanesById = new Map(currentSwimlanes.map((swimlane) => [swimlane.board_swimlane_id, swimlane]));
    const isCompleteOrder =
      getUnique(boardSwimlaneIds).length === currentSwimlanes.length &&
      boardSwimlaneIds.length === currentSwimlanes.length &&
      boardSwimlaneIds.every((boardSwimlaneId) => swimlanesById.has(boardSwimlaneId));

    if (!isCompleteOrder) {
      throw new HTTP400('Swimlane order must list every swimlane of the board exactly once');
    }

    await this.boardSwimlaneRepository.updateBoardSwimlaneSortOrder(boardId, boardSwimlaneIds);

    // Mirror the rewritten sort_order instead of re-reading the swimlanes.
    return boardSwimlaneIds.map((boardSwimlaneId, index) => ({
      ...(swimlanesById.get(boardSwimlaneId) as BoardSwimlane),
      sort_order: index
    }));
  }

  /**
   * Assert that every given board tag is active and belongs to the board.
   *
   * @private
   * @param {string} boardId - Board UUID.
   * @param {string[]} boardTagIds - Board tag UUIDs; duplicates are allowed.
   * @returns {Promise<void>}
   * @throws {HTTP400} If any board tag is unknown, deleted, or belongs to another board.
   * @memberof BoardSwimlaneService
   */
  private async assertBoardTagIds(boardId: string, boardTagIds: string[]): Promise<void> {
    const uniqueBoardTagIds = getUnique(boardTagIds);

    if (uniqueBoardTagIds.length === 0) {
      return;
    }

    const activeBoardTagIds = await this.boardTagRepository.getActiveBoardTagIds(boardId, uniqueBoardTagIds);

    if (activeBoardTagIds.length !== uniqueBoardTagIds.length) {
      throw new HTTP400('Swimlane tags must be active tags of the board');
    }
  }

  /**
   * Assert that no other active lane on the board has the given name (case-insensitive).
   *
   * @private
   * @param {string} boardId - Board UUID.
   * @param {string} name - Swimlane name.
   * @param {string} [boardSwimlaneId] - Swimlane being renamed, which may keep its own name.
   * @returns {Promise<void>}
   * @throws {ApiConflictError} If the name is taken by another active lane on the board.
   * @memberof BoardSwimlaneService
   */
  private async assertBoardSwimlaneNameAvailable(
    boardId: string,
    name: string,
    boardSwimlaneId?: string
  ): Promise<void> {
    const existingSwimlane = await this.boardSwimlaneRepository.findBoardSwimlaneByName(boardId, name);

    if (existingSwimlane && existingSwimlane.board_swimlane_id !== boardSwimlaneId) {
      throw new ApiConflictError('A swimlane with this name already exists on the board');
    }
  }
}
