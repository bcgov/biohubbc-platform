import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import { BoardSwimlane, BoardSwimlaneRequest } from '../models/board';
import { BoardRepository } from '../repositories/board-repository';
import { BoardSwimlaneRepository } from '../repositories/board-swimlane-repository';
import { getUnique } from '../utils/unique';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BoardTicketService } from './board-ticket-service';
import { DBService } from './db-service';

/**
 * Service for admin-only board swimlanes. Every operation is scoped to the owning board.
 */
export class BoardSwimlaneService extends DBService {
  boardRepository: BoardRepository;
  boardSwimlaneRepository: BoardSwimlaneRepository;
  boardTicketService: BoardTicketService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.boardRepository = new BoardRepository(connection);
    this.boardSwimlaneRepository = new BoardSwimlaneRepository(connection);
    this.boardTicketService = new BoardTicketService(connection);
  }

  /**
   * Get the active swimlanes of a board in display order.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<BoardSwimlane[]>} Active swimlanes.
   * @memberof BoardSwimlaneService
   */
  async getBoardSwimlanes(boardId: string): Promise<BoardSwimlane[]> {
    return this.boardSwimlaneRepository.getBoardSwimlanes(boardId);
  }

  /**
   * Get an active swimlane of a board.
   *
   * @param {string} boardId - Board UUID the swimlane must belong to.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @returns {Promise<BoardSwimlane>} The swimlane.
   * @throws {ApiNotFoundError} If the swimlane does not exist on the board.
   * @memberof BoardSwimlaneService
   */
  async getBoardSwimlane(boardId: string, boardSwimlaneId: string): Promise<BoardSwimlane> {
    return this.boardSwimlaneRepository.getBoardSwimlaneById(boardId, boardSwimlaneId);
  }

  /**
   * Get one page of the active swimlanes of a board, in display order unless a sort is given.
   *
   * @param {string} boardId - Board UUID.
   * @param {ApiPaginationOptions} [pagination] - Page, page size and sort.
   * @returns {Promise<BoardSwimlane[]>} One page of the board's swimlanes.
   * @memberof BoardSwimlaneService
   */
  async getPaginatedBoardSwimlanes(boardId: string, pagination?: ApiPaginationOptions): Promise<BoardSwimlane[]> {
    return this.boardSwimlaneRepository.getPaginatedBoardSwimlanes(boardId, pagination);
  }

  /**
   * Count the active swimlanes of a board.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<number>} Number of active swimlanes.
   * @memberof BoardSwimlaneService
   */
  async getBoardSwimlanesCount(boardId: string): Promise<number> {
    return this.boardSwimlaneRepository.getBoardSwimlanesCount(boardId);
  }

  /**
   * Create a visible swimlane at its sort order, or else at the end of a board.
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardSwimlaneRequest} swimlane - Swimlane payload.
   * @returns {Promise<BoardSwimlane>} Created swimlane.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @throws {ApiConflictError} If an active lane on the board already has the same name (case-insensitive).
   * @memberof BoardSwimlaneService
   */
  async createBoardSwimlane(boardId: string, swimlane: BoardSwimlaneRequest): Promise<BoardSwimlane> {
    await this.boardRepository.getBoardById(boardId);
    await this.assertBoardSwimlaneNameAvailable(boardId, swimlane.name);

    const created = await this.boardSwimlaneRepository.insertBoardSwimlane(boardId, {
      name: swimlane.name,
      description: swimlane.description,
      color: swimlane.color,
      sort_order: swimlane.sortOrder
    });

    return this.boardSwimlaneRepository.getBoardSwimlaneById(boardId, created.board_swimlane_id);
  }

  /**
   * Update a swimlane's name, description, color and, if given, sort order. Its visibility is kept.
   *
   * @param {string} boardId - Board UUID the swimlane must belong to.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @param {BoardSwimlaneRequest} swimlane - Swimlane payload.
   * @returns {Promise<BoardSwimlane>} Updated swimlane.
   * @throws {ApiNotFoundError} If the swimlane does not exist on the board.
   * @throws {ApiConflictError} If another active lane on the board already has the new name (case-insensitive).
   * @memberof BoardSwimlaneService
   */
  async updateBoardSwimlane(
    boardId: string,
    boardSwimlaneId: string,
    swimlane: BoardSwimlaneRequest
  ): Promise<BoardSwimlane> {
    await this.boardSwimlaneRepository.getBoardSwimlaneById(boardId, boardSwimlaneId);
    await this.assertBoardSwimlaneNameAvailable(boardId, swimlane.name, boardSwimlaneId);

    await this.boardSwimlaneRepository.updateBoardSwimlane(boardId, boardSwimlaneId, {
      name: swimlane.name,
      description: swimlane.description,
      color: swimlane.color,
      sort_order: swimlane.sortOrder
    });

    return this.boardSwimlaneRepository.getBoardSwimlaneById(boardId, boardSwimlaneId);
  }

  /**
   * Soft delete a swimlane that has no tickets. Every ticket on a board is in one of its lanes, so a lane's tickets must
   * first be moved to another lane or taken off the board. The board's default lane is cleared by the caller.
   *
   * @param {string} boardId - Board UUID the swimlane must belong to.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the swimlane does not exist on the board.
   * @throws {ApiConflictError} If the swimlane has tickets.
   * @memberof BoardSwimlaneService
   */
  async deleteBoardSwimlane(boardId: string, boardSwimlaneId: string): Promise<void> {
    await this.boardSwimlaneRepository.getBoardSwimlaneById(boardId, boardSwimlaneId);

    const ticketCount = await this.boardTicketService.getBoardSwimlaneTicketCount(boardSwimlaneId);

    if (ticketCount > 0) {
      throw new ApiConflictError("Move or remove the swimlane's tickets before deleting it");
    }

    await this.boardSwimlaneRepository.deleteBoardSwimlane(boardId, boardSwimlaneId);
  }

  /**
   * Soft delete every swimlane of a board. Callers end the board's tickets first.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @memberof BoardSwimlaneService
   */
  async deleteBoardSwimlanesByBoardId(boardId: string): Promise<void> {
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
