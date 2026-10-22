import { IDBConnection } from '../database/db';
import { BoardTicket, BoardTicketFilters } from '../models/board';
import { BoardTicketRepository } from '../repositories/board-ticket-repository';
import { DBService } from './db-service';

/**
 * Service for which tickets are on which boards, and in which lane.
 */
export class BoardTicketService extends DBService {
  boardTicketRepository: BoardTicketRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.boardTicketRepository = new BoardTicketRepository(connection);
  }

  /**
   * Get the active tickets on a board, each with its active tags and its lane, in their order within their lanes (ties:
   * oldest first).
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardTicketFilters} filters - Closed tickets are excluded unless include_closed is true.
   * @returns {Promise<BoardTicket[]>} The board's tickets with their tags and lanes.
   * @memberof BoardTicketService
   */
  async getBoardTickets(boardId: string, filters: BoardTicketFilters): Promise<BoardTicket[]> {
    return this.boardTicketRepository.getBoardTickets(boardId, filters);
  }

  /**
   * Count the active tickets in a lane.
   *
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @returns {Promise<number>} Number of tickets in the lane.
   * @memberof BoardTicketService
   */
  async getBoardSwimlaneTicketCount(boardSwimlaneId: string): Promise<number> {
    return this.boardTicketRepository.getBoardSwimlaneTicketCount(boardSwimlaneId);
  }

  /**
   * Put a ticket on a board at the end of a lane, or move it to the end of that lane if it is on the board in another.
   * Repeating it changes nothing.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} ticketId - Ticket UUID.
   * @param {string} boardSwimlaneId - The board's lane the ticket is in.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async ensureBoardTicket(boardId: string, ticketId: string, boardSwimlaneId: string): Promise<void> {
    await this.boardTicketRepository.ensureBoardTicket(boardId, ticketId, boardSwimlaneId);
  }

  /**
   * Put a ticket on a board at the end of a lane, unless it is already on the board, where it then stays where it is.
   * Repeating it changes nothing.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} ticketId - Ticket UUID.
   * @param {string} boardSwimlaneId - The board's lane a ticket not yet on the board is put in.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async insertBoardTicket(boardId: string, ticketId: string, boardSwimlaneId: string): Promise<void> {
    await this.boardTicketRepository.insertBoardTicket(boardId, ticketId, boardSwimlaneId);
  }

  /**
   * Put a ticket on every board linked to any of the given tags, last in the board's default lane. Boards the ticket is
   * already on, and boards without a default lane, are skipped.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string[]} tagIds - Tags just applied to the ticket.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async insertBoardTicketsByTagIds(ticketId: string, tagIds: string[]): Promise<void> {
    await this.boardTicketRepository.insertBoardTicketsByTagIds(ticketId, tagIds);
  }

  /**
   * Put every ticket that has a tag on a board, last in the board's default lane, oldest first. Tickets already on the
   * board stay where they are, and a board without a default lane gets none.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async insertBoardTicketsByTagId(boardId: string, tagId: string): Promise<void> {
    await this.boardTicketRepository.insertBoardTicketsByTagId(boardId, tagId);
  }

  /**
   * Move a ticket to a position within its lane, renumbering the lane's tickets around it. Positions past the end put
   * it last.
   *
   * @param {string} boardSwimlaneId - The lane the ticket is in.
   * @param {string} ticketId - Ticket UUID.
   * @param {number} position - Zero-based position among the lane's tickets.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async updateBoardTicketPosition(boardSwimlaneId: string, ticketId: string, position: number): Promise<void> {
    await this.boardTicketRepository.updateBoardTicketPosition(boardSwimlaneId, ticketId, position);
  }

  /**
   * Take a ticket off a board, if it is on it.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async deleteBoardTicket(boardId: string, ticketId: string): Promise<void> {
    await this.boardTicketRepository.deleteBoardTicket(boardId, ticketId);
  }

  /**
   * Take the tickets that have a tag off a board the tag is linked to. Call it before the link is ended. A ticket stays
   * on the board while it has another active tag linked to the board.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} tagId - The tag being unlinked from the board.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async deleteBoardTicketsByBoardTag(boardId: string, tagId: string): Promise<void> {
    await this.boardTicketRepository.deleteBoardTicketsByBoardTag(boardId, tagId);
  }

  /**
   * Take the tickets that have a tag off every board the tag is linked to. Call it before the tag's links are ended. A
   * ticket stays on a board while it has another active tag linked to that board.
   *
   * @param {string} tagId - The tag being deleted.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async deleteBoardTicketsByTagId(tagId: string): Promise<void> {
    await this.boardTicketRepository.deleteBoardTicketsByTagId(tagId);
  }

  /**
   * Take the tickets that a tag rule tagged off the boards their tag is linked to. Call it before the rule's tags are
   * removed. A ticket stays on a board while it has another active tag linked to that board.
   *
   * @param {string} tagRuleId - The tag rule whose tags are being removed.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async deleteBoardTicketsByTagRuleId(tagRuleId: string): Promise<void> {
    await this.boardTicketRepository.deleteBoardTicketsByTagRuleId(tagRuleId);
  }

  /**
   * Take a ticket off the boards linked to the tags it is losing: its active tags not in the given set. Call it before
   * they are removed. The ticket stays on a board while a tag in the given set is linked to that board.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string[]} tagIds - The ticket's tags after the change.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async deleteBoardTicketsByTicketTagsNotIn(ticketId: string, tagIds: string[]): Promise<void> {
    await this.boardTicketRepository.deleteBoardTicketsByTicketTagsNotIn(ticketId, tagIds);
  }

  /**
   * Take every ticket off a board.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async deleteBoardTicketsByBoardId(boardId: string): Promise<void> {
    await this.boardTicketRepository.deleteBoardTicketsByBoardId(boardId);
  }

  /**
   * Take a ticket off every board.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<void>}
   * @memberof BoardTicketService
   */
  async deleteBoardTicketsByTicketId(ticketId: string): Promise<void> {
    await this.boardTicketRepository.deleteBoardTicketsByTicketId(ticketId);
  }
}
