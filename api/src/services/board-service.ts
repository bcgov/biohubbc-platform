import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import {
  BoardDetail,
  BoardFilters,
  BoardRequest,
  BoardSummary,
  BoardTicketFilters,
  BoardTickets,
  BoardTicketSwimlane
} from '../models/board';
import { Tag, TagRequest } from '../models/tag';
import { TicketWithTags } from '../models/ticket';
import { BoardRepository } from '../repositories/board-repository';
import { BoardSwimlaneTagRepository } from '../repositories/board-swimlane-tag-repository';
import { BoardTagRepository } from '../repositories/board-tag-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BoardSwimlaneService } from './board-swimlane-service';
import { DBService } from './db-service';
import { TagService } from './tag-service';

/**
 * Service for admin-only boards and their computed ticket views.
 */
export class BoardService extends DBService {
  boardRepository: BoardRepository;
  boardTagRepository: BoardTagRepository;
  boardSwimlaneTagRepository: BoardSwimlaneTagRepository;
  boardSwimlaneService: BoardSwimlaneService;
  tagService: TagService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.boardRepository = new BoardRepository(connection);
    this.boardTagRepository = new BoardTagRepository(connection);
    this.boardSwimlaneTagRepository = new BoardSwimlaneTagRepository(connection);
    this.boardSwimlaneService = new BoardSwimlaneService(connection);
    this.tagService = new TagService(connection);
  }

  /**
   * List active boards with their tags and swimlane count.
   *
   * @param {BoardFilters} [filters] - Optional filters; `search` matches the board name.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination and sorting.
   * @returns {Promise<BoardSummary[]>} Active boards, ordered by name unless a sort is given.
   * @memberof BoardService
   */
  async getBoards(filters?: BoardFilters, pagination?: ApiPaginationOptions): Promise<BoardSummary[]> {
    return this.boardRepository.getBoards(filters, pagination);
  }

  /**
   * Count active boards matching the filters.
   *
   * @param {BoardFilters} [filters] - Optional filters.
   * @returns {Promise<number>} Number of matching boards.
   * @memberof BoardService
   */
  async getBoardsCount(filters?: BoardFilters): Promise<number> {
    return this.boardRepository.getBoardsCount(filters);
  }

  /**
   * Get a board's configuration: the board, its tags, and its swimlanes (with tags) in display order.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<BoardDetail>} Board configuration.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @memberof BoardService
   */
  async getBoard(boardId: string): Promise<BoardDetail> {
    const board = await this.boardRepository.getBoardById(boardId);

    const [tags, swimlanes] = await Promise.all([
      this.boardTagRepository.getBoardTags(boardId),
      this.boardSwimlaneService.getBoardSwimlanes(boardId)
    ]);

    return { ...board, tags, swimlanes };
  }

  /**
   * Create a board with its tags.
   *
   * @param {BoardRequest} board - Board payload.
   * @returns {Promise<BoardDetail>} Created board configuration.
   * @throws {ApiConflictError} If an active board already has the same name (case-insensitive).
   * @throws {HTTP400} If any tag is unknown or deleted.
   * @memberof BoardService
   */
  async createBoard(board: BoardRequest): Promise<BoardDetail> {
    await this.assertBoardNameAvailable(board.name);
    await this.tagService.assertActiveTagIds(board.tagIds);

    const createdBoard = await this.boardRepository.insertBoard({
      name: board.name,
      description: board.description
    });

    await this.boardTagRepository.insertBoardTags(createdBoard.board_id, board.tagIds);
    const tags = await this.boardTagRepository.getBoardTags(createdBoard.board_id);

    // A new board has no swimlanes yet.
    return { ...createdBoard, tags, swimlanes: [] };
  }

  /**
   * Update a board and replace its tag set. Removing a tag from the board also removes it from the board's lanes.
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardRequest} board - Board payload.
   * @returns {Promise<BoardDetail>} Updated board configuration.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @throws {ApiConflictError} If another active board already has the new name (case-insensitive).
   * @throws {HTTP400} If any tag is unknown or deleted.
   * @memberof BoardService
   */
  async updateBoard(boardId: string, board: BoardRequest): Promise<BoardDetail> {
    await this.boardRepository.getBoardById(boardId);
    await this.assertBoardNameAvailable(board.name, boardId);
    await this.tagService.assertActiveTagIds(board.tagIds);

    const updatedBoard = await this.boardRepository.updateBoard(boardId, {
      name: board.name,
      description: board.description
    });

    // Lanes may only use the board's tags, so lane links to removed board tags are ended first.
    await this.boardSwimlaneTagRepository.deleteBoardSwimlaneTagsForBoardTagsNotIn(boardId, board.tagIds);
    await this.boardTagRepository.deleteBoardTagsNotIn(boardId, board.tagIds);
    await this.boardTagRepository.insertBoardTags(boardId, board.tagIds);

    const [tags, swimlanes] = await Promise.all([
      this.boardTagRepository.getBoardTags(boardId),
      this.boardSwimlaneService.getBoardSwimlanes(boardId)
    ]);

    return { ...updatedBoard, tags, swimlanes };
  }

  /**
   * Create a tag and add it to a board. The tag is a regular tag, available to every ticket and board.
   *
   * @param {string} boardId - Board UUID.
   * @param {TagRequest} tag - Tag payload.
   * @returns {Promise<Tag>} Created tag.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @throws {ApiConflictError} If an active tag already has the same name (case-insensitive).
   * @memberof BoardService
   */
  async createBoardTag(boardId: string, tag: TagRequest): Promise<Tag> {
    await this.boardRepository.getBoardById(boardId);

    const createdTag = await this.tagService.createTag(tag);
    await this.boardTagRepository.insertBoardTags(boardId, [createdTag.tag_id]);

    return createdTag;
  }

  /**
   * Soft delete a board with its tag links, swimlanes, and swimlane tag links.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @memberof BoardService
   */
  async deleteBoard(boardId: string): Promise<void> {
    await this.boardRepository.getBoardById(boardId);

    await this.boardSwimlaneService.deleteBoardSwimlanesByBoardId(boardId);
    await this.boardTagRepository.deleteBoardTagsByBoardId(boardId);
    await this.boardRepository.deleteBoard(boardId);
  }

  /**
   * Get the tickets on a board grouped into swimlanes.
   *
   * Membership and lane placement are computed in SQL. Hiding is applied after placement: tickets placed in a hidden
   * lane are omitted and counted in hidden_ticket_count, never moved into another lane. Tickets matching no lane go
   * to `unsorted`, which is always visible.
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardTicketFilters} filters - Closed tickets are excluded unless include_closed is true.
   * @returns {Promise<BoardTickets>} Board, unsorted tickets, visible lanes with tickets, and hidden ticket count.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @memberof BoardService
   */
  async getBoardTickets(boardId: string, filters: BoardTicketFilters): Promise<BoardTickets> {
    const board = await this.boardRepository.getBoardById(boardId);

    const [swimlanes, boardTickets] = await Promise.all([
      this.boardSwimlaneService.getBoardSwimlanes(boardId),
      this.boardRepository.getBoardTickets(boardId, filters)
    ]);

    const ticketsBySwimlaneId = new Map<string | null, TicketWithTags[]>();

    for (const { board_swimlane_id, ...ticket } of boardTickets) {
      const swimlaneTickets = ticketsBySwimlaneId.get(board_swimlane_id) ?? [];
      swimlaneTickets.push(ticket);
      ticketsBySwimlaneId.set(board_swimlane_id, swimlaneTickets);
    }

    const visibleSwimlanes: BoardTicketSwimlane[] = swimlanes
      .filter((swimlane) => swimlane.is_visible)
      .map((swimlane) => ({
        board_swimlane_id: swimlane.board_swimlane_id,
        name: swimlane.name,
        color: swimlane.color,
        sort_order: swimlane.sort_order,
        tickets: ticketsBySwimlaneId.get(swimlane.board_swimlane_id) ?? []
      }));

    const hiddenTicketCount = swimlanes
      .filter((swimlane) => !swimlane.is_visible)
      .reduce((count, swimlane) => count + (ticketsBySwimlaneId.get(swimlane.board_swimlane_id)?.length ?? 0), 0);

    return {
      board,
      unsorted: ticketsBySwimlaneId.get(null) ?? [],
      swimlanes: visibleSwimlanes,
      hidden_ticket_count: hiddenTicketCount
    };
  }

  /**
   * Assert that no other active board has the given name (case-insensitive).
   *
   * @private
   * @param {string} name - Board name.
   * @param {string} [boardId] - Board being renamed, which may keep its own name.
   * @returns {Promise<void>}
   * @throws {ApiConflictError} If the name is taken by another active board.
   * @memberof BoardService
   */
  private async assertBoardNameAvailable(name: string, boardId?: string): Promise<void> {
    const existingBoard = await this.boardRepository.findBoardByName(name);

    if (existingBoard && existingBoard.board_id !== boardId) {
      throw new ApiConflictError('A board with this name already exists');
    }
  }
}
