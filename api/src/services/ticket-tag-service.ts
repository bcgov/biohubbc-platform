import { IDBConnection } from '../database/db';
import { TicketTags } from '../models/ticket-tag';
import { BoardTicketRepository } from '../repositories/board-ticket-repository';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketTagRepository } from '../repositories/ticket-tag-repository';
import { DBService } from './db-service';
import { TagService } from './tag-service';

/**
 * Service for admin-only ticket tags and their timeline history.
 */
export class TicketTagService extends DBService {
  ticketRepository: TicketRepository;
  ticketTagRepository: TicketTagRepository;
  boardTicketRepository: BoardTicketRepository;
  tagService: TagService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketRepository = new TicketRepository(connection);
    this.ticketTagRepository = new TicketTagRepository(connection);
    this.boardTicketRepository = new BoardTicketRepository(connection);
    this.tagService = new TagService(connection);
  }

  /**
   * Get a ticket's active tags and its tag added/removed history.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<TicketTags>} Active tags and tag events, oldest event first.
   * @throws {ApiNotFoundError} If the ticket does not exist or is deleted.
   * @memberof TicketTagService
   */
  async getTicketTags(ticketId: string): Promise<TicketTags> {
    await this.ticketRepository.getTicketById(ticketId);

    return this.getTicketTagsAndEvents(ticketId);
  }

  /**
   * Replace a ticket's whole tag set.
   *
   * Removed tags are soft-deleted and added tags inserted; tags in both sets are left untouched so their
   * history is not rewritten. Adding a tag puts the ticket on the boards linked to it, in their default lanes; removing
   * one does not take it off. Callers own the surrounding transaction.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string[]} tagIds - Desired tag UUIDs. Empty removes every tag.
   * @returns {Promise<TicketTags>} The ticket's tags and tag events after the change.
   * @throws {ApiNotFoundError} If the ticket does not exist or is deleted.
   * @throws {HTTP400} If any tag is unknown or deleted.
   * @memberof TicketTagService
   */
  async replaceTicketTags(ticketId: string, tagIds: string[]): Promise<TicketTags> {
    await this.ticketRepository.getTicketById(ticketId);
    await this.tagService.assertActiveTagIds(tagIds);

    await this.ticketTagRepository.deleteTicketTagsNotIn(ticketId, tagIds);
    const addedTags = await this.ticketTagRepository.insertTicketTags(ticketId, tagIds);

    if (addedTags.length) {
      await this.boardTicketRepository.insertBoardTicketsByTagIds(
        ticketId,
        addedTags.map((tag) => tag.tag_id)
      );
    }

    return this.getTicketTagsAndEvents(ticketId);
  }

  /**
   * Read a ticket's active tags and tag events.
   *
   * @private
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<TicketTags>} Active tags and tag events.
   * @memberof TicketTagService
   */
  private async getTicketTagsAndEvents(ticketId: string): Promise<TicketTags> {
    const [tags, events] = await Promise.all([
      this.ticketTagRepository.getTicketTagSummaries(ticketId),
      this.ticketTagRepository.getTicketTagEvents(ticketId)
    ]);

    return { tags, events };
  }
}
