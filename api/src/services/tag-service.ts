import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import { Tag, TagFilters, TagRequest } from '../models/tag';
import { BoardTagRepository } from '../repositories/board-tag-repository';
import { TagRepository } from '../repositories/tag-repository';
import { TagRuleRepository } from '../repositories/tag-rule-repository';
import { TicketTagRepository } from '../repositories/ticket-tag-repository';
import { getUnique } from '../utils/unique';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Service for admin-only tag management.
 */
export class TagService extends DBService {
  tagRepository: TagRepository;
  ticketTagRepository: TicketTagRepository;
  boardTagRepository: BoardTagRepository;
  tagRuleRepository: TagRuleRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.tagRepository = new TagRepository(connection);
    this.ticketTagRepository = new TicketTagRepository(connection);
    this.boardTagRepository = new BoardTagRepository(connection);
    this.tagRuleRepository = new TagRuleRepository(connection);
  }

  /**
   * List active tags.
   *
   * @param {TagFilters} [filters] - Optional filters: `search` matches the tag name; `board_id` keeps a board's tags.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination and sorting.
   * @returns {Promise<Tag[]>} Active tags, ordered by name unless a sort is given.
   * @memberof TagService
   */
  async getTags(filters?: TagFilters, pagination?: ApiPaginationOptions): Promise<Tag[]> {
    return this.tagRepository.getTags(filters, pagination);
  }

  /**
   * Get an active tag.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<Tag>} The tag.
   * @throws {ApiNotFoundError} If the tag does not exist or is deleted.
   * @memberof TagService
   */
  async getTag(tagId: string): Promise<Tag> {
    return this.tagRepository.getTagById(tagId);
  }

  /**
   * Count active tags matching the filters.
   *
   * @param {TagFilters} [filters] - Optional filters.
   * @returns {Promise<number>} Number of matching tags.
   * @memberof TagService
   */
  async getTagsCount(filters?: TagFilters): Promise<number> {
    return this.tagRepository.getTagsCount(filters);
  }

  /**
   * Create a tag.
   *
   * @param {TagRequest} tag - Tag payload.
   * @returns {Promise<Tag>} Created tag.
   * @throws {ApiConflictError} If an active tag already has the same name (case-insensitive).
   * @memberof TagService
   */
  async createTag(tag: TagRequest): Promise<Tag> {
    await this.assertTagNameAvailable(tag.name);

    return this.tagRepository.insertTag(tag);
  }

  /**
   * Update a tag's name, description, and color.
   *
   * @param {string} tagId - Tag UUID.
   * @param {TagRequest} tag - Tag payload.
   * @returns {Promise<Tag>} Updated tag.
   * @throws {ApiNotFoundError} If the tag does not exist or is deleted.
   * @throws {ApiConflictError} If another active tag already has the new name (case-insensitive).
   * @memberof TagService
   */
  async updateTag(tagId: string, tag: TagRequest): Promise<Tag> {
    await this.tagRepository.getTagById(tagId);
    await this.assertTagNameAvailable(tag.name, tagId);

    return this.tagRepository.updateTag(tagId, tag);
  }

  /**
   * Soft delete a tag, its tag rules, and every active link to it from tickets and boards.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the tag does not exist or is deleted.
   * @memberof TagService
   */
  async deleteTag(tagId: string): Promise<void> {
    await this.tagRepository.getTagById(tagId);

    await this.boardTagRepository.deleteBoardTagsByTagId(tagId);
    await this.ticketTagRepository.deleteTicketTagsByTagId(tagId);
    await this.tagRuleRepository.deleteTagRulesByTagId(tagId);
    await this.tagRepository.deleteTag(tagId);
  }

  /**
   * Assert that every given tag exists and is active.
   *
   * @param {string[]} tagIds - Tag UUIDs; duplicates are allowed.
   * @returns {Promise<void>}
   * @throws {HTTP400} If any tag is unknown or deleted.
   * @memberof TagService
   */
  async assertActiveTagIds(tagIds: string[]): Promise<void> {
    const uniqueTagIds = getUnique(tagIds);

    if (uniqueTagIds.length === 0) {
      return;
    }

    const activeTagIds = await this.tagRepository.getActiveTagIds(uniqueTagIds);

    if (activeTagIds.length !== uniqueTagIds.length) {
      const activeTagIdSet = new Set(activeTagIds.map((activeTagId) => activeTagId.tag_id));
      const invalidTagIds = uniqueTagIds.filter((tagId) => !activeTagIdSet.has(tagId));

      throw new HTTP400('One or more tags do not exist', [{ invalidTagIds }]);
    }
  }

  /**
   * Assert that no other active tag has the given name (case-insensitive).
   *
   * @private
   * @param {string} name - Tag name.
   * @param {string} [tagId] - Tag being renamed, which may keep its own name.
   * @returns {Promise<void>}
   * @throws {ApiConflictError} If the name is taken by another active tag.
   * @memberof TagService
   */
  private async assertTagNameAvailable(name: string, tagId?: string): Promise<void> {
    const existingTag = await this.tagRepository.findTagByName(name);

    if (existingTag && existingTag.tag_id !== tagId) {
      throw new ApiConflictError('A tag with this name already exists');
    }
  }
}
