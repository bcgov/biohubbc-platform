import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Tag, TagFilters, TagId, TagRequest } from '../models/tag';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const TAG_COLUMNS = ['tag_id', 'name', 'description', 'color', 'create_date'] as const;

/**
 * Repository for tag table operations.
 */
export class TagRepository extends BaseRepository {
  /**
   * Apply tag list filters to a query over `tag`.
   *
   * @param {Knex.QueryBuilder} query - Query over the tag table.
   * @param {TagFilters} [filters] - `search` matches the name case-insensitively; `board_id` keeps the board's tags.
   * @returns {Knex.QueryBuilder} The filtered query.
   * @memberof TagRepository
   */
  applyFilters(query: Knex.QueryBuilder, filters?: TagFilters): Knex.QueryBuilder {
    if (filters?.search) {
      query = query.whereILike('tag.name', `%${filters.search}%`);
    }

    if (filters?.board_id) {
      const knex = getKnex();

      query = query.whereExists(
        knex('board_tag')
          .select(knex.raw('1'))
          .whereRaw('board_tag.tag_id = tag.tag_id')
          .where('board_tag.board_id', filters.board_id)
          .whereNull('board_tag.record_end_date')
      );
    }

    return query;
  }

  /**
   * List active tags, ordered by case-insensitive name unless a sort is given.
   *
   * @param {TagFilters} [filters] - Optional filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination and sorting.
   * @returns {Promise<Tag[]>} Matching active tags.
   * @memberof TagRepository
   */
  async getTags(filters?: TagFilters, pagination?: ApiPaginationOptions): Promise<Tag[]> {
    const knex = getKnex();
    let query = knex('tag').select(TAG_COLUMNS).whereNull('tag.record_end_date');
    query = this.applyFilters(query, filters);
    query = this.applyPagination(query, pagination);

    if (!pagination?.sort) {
      query = query.orderByRaw('lower(tag.name) ASC, tag.tag_id ASC');
    }

    const response = await this.connection.knex(query, Tag);

    return response.rows;
  }

  /**
   * Count active tags matching the filters.
   *
   * @param {TagFilters} [filters] - Optional filters.
   * @returns {Promise<number>} Number of matching tags.
   * @memberof TagRepository
   */
  async getTagsCount(filters?: TagFilters): Promise<number> {
    const knex = getKnex();
    let query = knex('tag').select(knex.raw('count(*)::integer as count')).whereNull('tag.record_end_date');
    query = this.applyFilters(query, filters);

    const response = await this.connection.knex(query);

    return response.rows[0]?.count ?? 0;
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
