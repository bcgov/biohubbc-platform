import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Tag, TagFilters, TagId, TagRequest } from '../models/tag';
import { BaseRepository } from './base-repository';

const TAG_COLUMNS = ['tag_id', 'name', 'description', 'color', 'create_date'] as const;

/**
 * Repository for tag table operations.
 */
export class TagRepository extends BaseRepository {
  /**
   * List active tags ordered by case-insensitive name.
   *
   * @param {TagFilters} [filters] - Optional filters; `search` matches the tag name case-insensitively.
   * @returns {Promise<Tag[]>} Matching active tags.
   * @memberof TagRepository
   */
  async getTags(filters?: TagFilters): Promise<Tag[]> {
    const knex = getKnex();
    let query = knex('tag').select(TAG_COLUMNS).whereNull('record_end_date');

    if (filters?.search) {
      query = query.whereILike('name', `%${filters.search}%`);
    }

    query = query.orderByRaw('lower(name) ASC, tag_id ASC');

    const response = await this.connection.knex(query, Tag);

    return response.rows;
  }

  /**
   * Get a single active tag by UUID.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<Tag>} Matching tag.
   * @throws {ApiNotFoundError} If no matching active tag exists.
   * @memberof TagRepository
   */
  async getTagById(tagId: string): Promise<Tag> {
    const knex = getKnex();
    const query = knex('tag').select(TAG_COLUMNS).where('tag_id', tagId).whereNull('record_end_date');

    const response = await this.connection.knex(query, Tag);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Tag not found', ['TagRepository->getTagById', { tagId }]);
    }

    return response.rows[0];
  }

  /**
   * Find the active tag with a case-insensitively matching name.
   *
   * @param {string} name - Tag name.
   * @returns {Promise<Tag | undefined>} Matching active tag, if any.
   * @memberof TagRepository
   */
  async findTagByName(name: string): Promise<Tag | undefined> {
    const knex = getKnex();
    const query = knex('tag')
      .select(TAG_COLUMNS)
      .whereRaw('lower(name) = lower(?)', [name])
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, Tag);

    return response.rows[0];
  }

  /**
   * Get the identifiers of the given tags that exist and are active.
   *
   * @param {string[]} tagIds - Tag UUIDs to check.
   * @returns {Promise<TagId[]>} Active tag identifiers among the input.
   * @memberof TagRepository
   */
  async getActiveTagIds(tagIds: string[]): Promise<TagId[]> {
    const knex = getKnex();
    const query = knex('tag').select('tag_id').whereIn('tag_id', tagIds).whereNull('record_end_date');

    const response = await this.connection.knex(query, TagId);

    return response.rows;
  }

  /**
   * Insert a tag.
   *
   * @param {TagRequest} tag - Tag payload.
   * @returns {Promise<Tag>} Created tag.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof TagRepository
   */
  async insertTag(tag: TagRequest): Promise<Tag> {
    const knex = getKnex();
    const query = knex('tag')
      .insert({
        name: tag.name,
        description: tag.description,
        color: tag.color
      })
      .returning(TAG_COLUMNS);

    const response = await this.connection.knex(query, Tag);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert tag', [
        'TagRepository->insertTag',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an active tag.
   *
   * @param {string} tagId - Tag UUID.
   * @param {TagRequest} tag - Tag payload.
   * @returns {Promise<Tag>} Updated tag.
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof TagRepository
   */
  async updateTag(tagId: string, tag: TagRequest): Promise<Tag> {
    const knex = getKnex();
    const query = knex('tag')
      .update({
        name: tag.name,
        description: tag.description,
        color: tag.color
      })
      .where('tag_id', tagId)
      .whereNull('record_end_date')
      .returning(TAG_COLUMNS);

    const response = await this.connection.knex(query, Tag);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update tag', [
        'TagRepository->updateTag',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete an active tag.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof TagRepository
   */
  async deleteTag(tagId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('tag')
      .update({ record_end_date: knex.fn.now() })
      .where('tag_id', tagId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete tag', [
        'TagRepository->deleteTag',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }
}
