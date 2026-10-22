import { DEFAULT_BOARD_SWIMLANE_NAME } from '../constants/board';
import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import {
  Board,
  BoardDetail,
  BoardFilters,
  BoardRequest,
  BoardTicketCreateRequest,
  BoardTicketFilters,
  BoardTicketRequest,
  BoardTickets,
  BoardTicketSwimlane
} from '../models/board';
import { Tag, TagRequest } from '../models/tag';
import { Ticket, TicketWithTags } from '../models/ticket';
import { BoardRepository } from '../repositories/board-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BoardSwimlaneService } from './board-swimlane-service';
import { BoardTagService } from './board-tag-service';
import { BoardTicketService } from './board-ticket-service';
import { DBService } from './db-service';
import { TagService } from './tag-service';
import { TicketService } from './ticket-service';

/**
 * Service for admin-only boards, their lanes, and the tickets on them.
 */
export class BoardService extends DBService {
  boardRepository: BoardRepository;
  boardSwimlaneService: BoardSwimlaneService;
  boardTagService: BoardTagService;
  boardTicketService: BoardTicketService;
  ticketService: TicketService;
  tagService: TagService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.boardRepository = new BoardRepository(connection);
    this.boardSwimlaneService = new BoardSwimlaneService(connection);
    this.boardTagService = new BoardTagService(connection);
    this.boardTicketService = new BoardTicketService(connection);
    this.ticketService = new TicketService(connection);
    this.tagService = new TagService(connection);
  }

  /**
   * List active boards.
   *
   * @param {BoardFilters} [filters] - Optional filters; `search` matches the board name.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination and sorting.
   * @returns {Promise<Board[]>} Active boards, ordered by name unless a sort is given.
   * @memberof BoardService
   */
  async getBoards(filters?: BoardFilters, pagination?: ApiPaginationOptions): Promise<Board[]> {
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
   * Get a board with its swimlanes in display order.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<BoardDetail>} The board and its swimlanes.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @memberof BoardService
   */
  async getBoard(boardId: string): Promise<BoardDetail> {
    const board = await this.boardRepository.getBoardById(boardId);
    const swimlanes = await this.boardSwimlaneService.getBoardSwimlanes(boardId);

    return { ...board, swimlanes };
  }

  /**
   * Create a board with its first lane, To Do, as its default lane, so tickets can be put on it at once.
   *
   * @param {BoardRequest} board - Board payload.
   * @returns {Promise<BoardDetail>} The created board, with To Do as its default lane.
   * @throws {ApiConflictError} If an active board already has the same name (case-insensitive).
   * @memberof BoardService
   */
  async createBoard(board: BoardRequest): Promise<BoardDetail> {
    await this.assertBoardNameAvailable(board.name);

    const createdBoard = await this.boardRepository.insertBoard({
      name: board.name,
      description: board.description
    });
    const toDoSwimlane = await this.boardSwimlaneService.createBoardSwimlane(createdBoard.board_id, {
      name: DEFAULT_BOARD_SWIMLANE_NAME,
      description: null,
      color: null
    });
    await this.boardRepository.updateBoardDefaultSwimlane(createdBoard.board_id, toDoSwimlane.board_swimlane_id);

    return { ...createdBoard, default_swimlane_id: toDoSwimlane.board_swimlane_id, swimlanes: [toDoSwimlane] };
  }

  /**
   * Update a board's name and description.
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardRequest} board - Board payload.
   * @returns {Promise<BoardDetail>} The updated board and its swimlanes.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @throws {ApiConflictError} If another active board already has the new name (case-insensitive).
   * @memberof BoardService
   */
  async updateBoard(boardId: string, board: BoardRequest): Promise<BoardDetail> {
    await this.boardRepository.getBoardById(boardId);
    await this.assertBoardNameAvailable(board.name, boardId);

    const updatedBoard = await this.boardRepository.updateBoard(boardId, {
      name: board.name,
      description: board.description
    });
    const swimlanes = await this.boardSwimlaneService.getBoardSwimlanes(boardId);

    return { ...updatedBoard, swimlanes };
  }

  /**
   * Soft delete a board with its tickets' places on it, its tag links and its swimlanes. The tickets and tags themselves
   * are not affected.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @memberof BoardService
   */
  async deleteBoard(boardId: string): Promise<void> {
    await this.boardRepository.getBoardById(boardId);

    // Board tickets reference the board's lanes, so they are ended before the lanes.
    await this.boardTicketService.deleteBoardTicketsByBoardId(boardId);
    await this.boardTagService.deleteBoardTagsByBoardId(boardId);
    await this.boardSwimlaneService.deleteBoardSwimlanesByBoardId(boardId);
    await this.boardRepository.deleteBoard(boardId);
  }

  /**
   * Create a tag and link it to a board, so applying it to a ticket puts the ticket on the board. The tag is a regular
   * tag, available to every ticket.
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
    await this.boardTagService.ensureBoardTag(boardId, createdTag.tag_id);

    return createdTag;
  }

  /**
   * Link an existing tag to a board, so applying it to a ticket puts the ticket on the board. Linking it also puts the
   * tickets that already have it on the board, last in its default lane, oldest first; tag rules are not re-evaluated.
   * Linking a linked tag changes nothing, so tickets taken off the board stay off.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the board or the tag does not exist or is deleted.
   * @memberof BoardService
   */
  async ensureBoardTag(boardId: string, tagId: string): Promise<void> {
    await this.boardRepository.getBoardById(boardId);
    await this.tagService.getTag(tagId);

    await this.boardTagService.ensureBoardTag(boardId, tagId);
  }

  /**
   * Unlink a tag from a board. Unlinking it also takes the tickets that have it off the board, except those that have
   * another tag linked to the board. The tag itself is not affected. Unlinking an unlinked tag changes nothing.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @memberof BoardService
   */
  async deleteBoardTag(boardId: string, tagId: string): Promise<void> {
    await this.boardRepository.getBoardById(boardId);

    await this.boardTagService.deleteBoardTag(boardId, tagId);
  }

  /**
   * Get the tickets on a board, every one of them oldest first, and grouped by lane in their order within the lane. Each
   * ticket is in exactly one lane. Every lane is returned, hidden ones included, with its visibility.
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardTicketFilters} filters - Closed tickets are excluded unless include_closed is true.
   * @returns {Promise<BoardTickets>} The board, its tickets, and its lanes with their tickets in display order.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @memberof BoardService
   */
  async getBoardTickets(boardId: string, filters: BoardTicketFilters): Promise<BoardTickets> {
    const board = await this.boardRepository.getBoardById(boardId);

    const [swimlanes, boardTickets] = await Promise.all([
      this.boardSwimlaneService.getBoardSwimlanes(boardId),
      this.boardTicketService.getBoardTickets(boardId, filters)
    ]);

    const tickets: TicketWithTags[] = [];
    const ticketsBySwimlaneId = new Map<string, TicketWithTags[]>();

    for (const { board_swimlane_id, ...ticket } of boardTickets) {
      tickets.push(ticket);

      const swimlaneTickets = ticketsBySwimlaneId.get(board_swimlane_id) ?? [];
      swimlaneTickets.push(ticket);
      ticketsBySwimlaneId.set(board_swimlane_id, swimlaneTickets);
    }

    // The whole board is listed oldest first; the lanes keep the order their tickets were moved into.
    tickets.sort(
      (first, second) =>
        first.create_date.localeCompare(second.create_date) || first.ticket_id.localeCompare(second.ticket_id)
    );

    const ticketSwimlanes: BoardTicketSwimlane[] = swimlanes.map((swimlane) => ({
      board_swimlane_id: swimlane.board_swimlane_id,
      name: swimlane.name,
      color: swimlane.color,
      sort_order: swimlane.sort_order,
      is_visible: swimlane.is_visible,
      tickets: ticketsBySwimlaneId.get(swimlane.board_swimlane_id) ?? []
    }));

    return { board, tickets, swimlanes: ticketSwimlanes };
  }

  /**
   * Create a ticket on a board, in the board's default lane.
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardTicketCreateRequest} ticket - Ticket fields.
   * @returns {Promise<Ticket>} The created ticket.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @memberof BoardService
   */
  async createBoardTicket(boardId: string, ticket: BoardTicketCreateRequest): Promise<Ticket> {
    const defaultSwimlaneId = await this.getDefaultBoardSwimlaneId(boardId);

    const createdTicket = await this.ticketService.createTicket({
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority
    });
    await this.boardTicketService.insertBoardTicket(boardId, createdTicket.ticket_id, defaultSwimlaneId);

    return createdTicket;
  }

  /**
   * Put a ticket on a board, or move it within or between the board's lanes. Given a lane, the ticket is put in it, at
   * the given position or else last when it changes lane. Without one, a ticket not on the board is put last in the
   * board's default lane, and a ticket already on it stays where it is. Repeating it changes nothing.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} ticketId - Ticket UUID.
   * @param {BoardTicketRequest} boardTicket - The board's lane the ticket is in and its position there, if picked.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the board, the lane on the board, or the ticket does not exist.
   * @throws {HTTP400} If a position is given without a lane.
   * @memberof BoardService
   */
  async ensureBoardTicket(boardId: string, ticketId: string, boardTicket: BoardTicketRequest): Promise<void> {
    if (boardTicket.position !== undefined && !boardTicket.boardSwimlaneId) {
      throw new HTTP400('A position requires a swimlane');
    }

    await this.ticketService.getTicketById(ticketId);

    if (boardTicket.boardSwimlaneId) {
      await this.boardSwimlaneService.getBoardSwimlane(boardId, boardTicket.boardSwimlaneId);
      await this.boardTicketService.ensureBoardTicket(boardId, ticketId, boardTicket.boardSwimlaneId);

      if (boardTicket.position !== undefined) {
        await this.boardTicketService.updateBoardTicketPosition(
          boardTicket.boardSwimlaneId,
          ticketId,
          boardTicket.position
        );
      }
      return;
    }

    const defaultSwimlaneId = await this.getDefaultBoardSwimlaneId(boardId);
    await this.boardTicketService.insertBoardTicket(boardId, ticketId, defaultSwimlaneId);
  }

  /**
   * Take a ticket off a board. The ticket itself is not affected. Removing a ticket that is not on the board changes
   * nothing.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @memberof BoardService
   */
  async deleteBoardTicket(boardId: string, ticketId: string): Promise<void> {
    await this.boardRepository.getBoardById(boardId);

    await this.boardTicketService.deleteBoardTicket(boardId, ticketId);
  }

  /**
   * Soft delete a lane that has no tickets. Deleting the board's default lane leaves the board without one, so tickets
   * cannot be added to it until it has a default again.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the board does not exist, or the swimlane does not exist on the board.
   * @throws {ApiConflictError} If the swimlane has tickets.
   * @memberof BoardService
   */
  async deleteBoardSwimlane(boardId: string, boardSwimlaneId: string): Promise<void> {
    const board = await this.boardRepository.getBoardById(boardId);

    await this.boardSwimlaneService.deleteBoardSwimlane(boardId, boardSwimlaneId);

    if (board.default_swimlane_id === boardSwimlaneId) {
      await this.boardRepository.updateBoardDefaultSwimlane(boardId, null);
    }
  }

  /**
   * The lane tickets created on or added to a board go in: the board's default lane, To Do unless it was changed.
   *
   * @private
   * @param {string} boardId - Board UUID.
   * @returns {Promise<string>} The default lane's UUID.
   * @throws {ApiNotFoundError} If the board does not exist or is deleted.
   * @throws {ApiConflictError} If the board has no default lane.
   * @memberof BoardService
   */
  private async getDefaultBoardSwimlaneId(boardId: string): Promise<string> {
    const board = await this.boardRepository.getBoardById(boardId);

    if (!board.default_swimlane_id) {
      throw new ApiConflictError('The board has no default swimlane to put tickets in');
    }

    return board.default_swimlane_id;
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
