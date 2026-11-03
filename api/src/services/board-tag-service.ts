import { IDBConnection } from '../database/db';
import { BoardTagRepository } from '../repositories/board-tag-repository';
import { BoardTicketService } from './board-ticket-service';
import { DBService } from './db-service';

/**
 * Service for the tags linked to boards: applying a linked tag to a ticket puts the ticket on the board, and removing it
 * takes the ticket off, unless another of its tags is linked to the board.
 */
export class BoardTagService extends DBService {
  boardTagRepository: BoardTagRepository;
  boardTicketService: BoardTicketService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.boardTagRepository = new BoardTagRepository(connection);
    this.boardTicketService = new BoardTicketService(connection);
  }

  /**
   * Link a tag to a board. Linking it also puts the tickets that already have it on the board, last in its default
   * lane, oldest first. Linking a linked tag changes nothing, so tickets taken off the board stay off.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof BoardTagService
   */
  async ensureBoardTag(boardId: string, tagId: string): Promise<void> {
    const linkedTags = await this.boardTagRepository.insertBoardTags(boardId, [tagId]);

    if (linkedTags.length) {
      await this.boardTicketService.insertBoardTicketsByTagId(boardId, tagId);
    }
  }

  /**
   * Unlink a tag from a board, taking the tickets that have it off the board unless another of their tags is linked to
   * it. Unlinking an unlinked tag changes nothing.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof BoardTagService
   */
  async deleteBoardTag(boardId: string, tagId: string): Promise<void> {
    // Tickets are taken off while the link still shows which tickets it put on the board.
    await this.boardTicketService.deleteBoardTicketsByBoardTag(boardId, tagId);
    await this.boardTagRepository.deleteBoardTag(boardId, tagId);
  }

  /**
   * Unlink every tag from a board. The board's tickets are not affected.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @memberof BoardTagService
   */
  async deleteBoardTagsByBoardId(boardId: string): Promise<void> {
    await this.boardTagRepository.deleteBoardTagsByBoardId(boardId);
  }

  /**
   * Unlink a tag from every board, taking the tickets that have it off those boards unless another of their tags is
   * linked to them.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof BoardTagService
   */
  async deleteBoardTagsByTagId(tagId: string): Promise<void> {
    // Tickets are taken off boards while the tag's links still show which boards it put them on.
    await this.boardTicketService.deleteBoardTicketsByTagId(tagId);
    await this.boardTagRepository.deleteBoardTagsByTagId(tagId);
  }
}
