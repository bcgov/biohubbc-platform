import { IDBConnection } from '../database/db';
import { RuleTicketTag } from '../models/tag-rule';
import { TicketTags } from '../models/ticket-tag';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketTagRepository } from '../repositories/ticket-tag-repository';
import { BoardTicketService } from './board-ticket-service';
import { DBService } from './db-service';
import { TagService } from './tag-service';

/**
 * Service for admin-only ticket tags and their timeline history.
 */
export class TicketTagService extends DBService {
  ticketRepository: TicketRepository;
  ticketTagRepository: TicketTagRepository;
  boardTicketService: BoardTicketService;
  tagService: TagService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.ticketRepository = new TicketRepository(connection);
    this.ticketTagRepository = new TicketTagRepository(connection);
    this.boardTicketService = new BoardTicketService(connection);
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
   * one takes it off those boards, unless another of its tags is linked to them. Callers own the surrounding
   * transaction.
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

    // The ticket is taken off boards while its removed tags still show which boards they put it on.
    await this.boardTicketService.deleteBoardTicketsByTicketTagsNotIn(ticketId, tagIds);
    await this.ticketTagRepository.deleteTicketTagsNotIn(ticketId, tagIds);
    const addedTags = await this.ticketTagRepository.insertTicketTags(ticketId, tagIds);

    if (addedTags.length) {
      await this.boardTicketService.insertBoardTicketsByTagIds(
        ticketId,
        addedTags.map((tag) => tag.tag_id)
      );
    }

    return this.getTicketTagsAndEvents(ticketId);
  }

  /**
   * Add the tags of the rules that matched a ticket, skipping any tag the ticket has ever had, so a removed tag stays
   * removed. Each tag added puts the ticket on the boards linked to it, in their default lanes, like a tag added by
   * hand.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {RuleTicketTag[]} ruleTicketTags - Tags to add, each with the rule that matched.
   * @returns {Promise<void>}
   * @memberof TicketTagService
   */
  async insertRuleTicketTags(ticketId: string, ruleTicketTags: RuleTicketTag[]): Promise<void> {
    const addedTags = await this.ticketTagRepository.insertRuleTicketTags(ticketId, ruleTicketTags);

    if (addedTags.length) {
      await this.boardTicketService.insertBoardTicketsByTagIds(
        ticketId,
        addedTags.map((tag) => tag.tag_id)
      );
    }
  }

  /**
   * Remove the tags a tag rule applied from every ticket, taking the tickets off the boards those tags are linked to,
   * except boards another of their tags is linked to.
   *
   * @param {string} tagRuleId - Tag rule UUID.
   * @returns {Promise<void>}
   * @memberof TicketTagService
   */
  async deleteTicketTagsByTagRuleId(tagRuleId: string): Promise<void> {
    // Tickets are taken off boards while the rule's tags still show which boards they put them on.
    await this.boardTicketService.deleteBoardTicketsByTagRuleId(tagRuleId);
    await this.ticketTagRepository.deleteTicketTagsByTagRuleId(tagRuleId);
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
