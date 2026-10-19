import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  TagRule,
  TagRuleEvaluation,
  TagRuleId,
  TagRulePayload,
  TagRuleSummary,
  TicketSubmissionUploadScope
} from '../models/tag-rule';
import { BaseRepository } from './base-repository';
import {
  orWhereDataRequestReferencesExpression,
  orWhereSubmissionUploadMatchesExpression
} from './tag-rule-expression-sql';

const TAG_RULE_RETURNING_COLUMNS = [
  'tag_rule_id',
  'tag_id',
  'name',
  'description',
  'is_enabled',
  'expression_id',
  'create_date'
] as const;

// Qualified for queries that join the tag table, which shares several column names.
const TAG_RULE_COLUMNS = TAG_RULE_RETURNING_COLUMNS.map((column) => `tag_rule.${column}`);

/**
 * Repository for tag_rule table operations, including rule matching against a ticket.
 */
export class TagRuleRepository extends BaseRepository {
  /**
   * List active tag rules with their tag, ordered by case-insensitive name.
   *
   * @returns {Promise<TagRuleSummary[]>} Active tag rules.
   * @memberof TagRuleRepository
   */
  async getTagRules(): Promise<TagRuleSummary[]> {
    const knex = getKnex();
    const query = knex('tag_rule')
      .select([...TAG_RULE_COLUMNS, 'tag.name as tag_name', 'tag.color as tag_color'])
      .join('tag', 'tag.tag_id', 'tag_rule.tag_id')
      .whereNull('tag_rule.record_end_date')
      .orderByRaw('lower(tag_rule.name) ASC, tag_rule.tag_rule_id ASC');

    const response = await this.connection.knex(query, TagRuleSummary);

    return response.rows;
  }

  /**
   * Get a single active tag rule with its tag.
   *
   * @param {string} tagRuleId - Tag rule UUID.
   * @returns {Promise<TagRuleSummary>} Matching tag rule.
   * @throws {ApiNotFoundError} If no matching active tag rule exists.
   * @memberof TagRuleRepository
   */
  async getTagRuleById(tagRuleId: string): Promise<TagRuleSummary> {
    const knex = getKnex();
    const query = knex('tag_rule')
      .select([...TAG_RULE_COLUMNS, 'tag.name as tag_name', 'tag.color as tag_color'])
      .join('tag', 'tag.tag_id', 'tag_rule.tag_id')
      .where('tag_rule.tag_rule_id', tagRuleId)
      .whereNull('tag_rule.record_end_date');

    const response = await this.connection.knex(query, TagRuleSummary);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Tag rule not found', ['TagRuleRepository->getTagRuleById', { tagRuleId }]);
    }

    return response.rows[0];
  }

  /**
   * Find the active tag rule with a case-insensitively matching name.
   *
   * @param {string} name - Tag rule name.
   * @returns {Promise<TagRuleId | undefined>} Matching active tag rule identifier, if any.
   * @memberof TagRuleRepository
   */
  async findTagRuleByName(name: string): Promise<TagRuleId | undefined> {
    const knex = getKnex();
    const query = knex('tag_rule')
      .select('tag_rule_id')
      .whereRaw('lower(name) = lower(?)', [name])
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, TagRuleId);

    return response.rows[0];
  }

  /**
   * Get the enabled active tag rules whose tag is active, oldest first.
   *
   * @returns {Promise<TagRule[]>} Enabled tag rules.
   * @memberof TagRuleRepository
   */
  async getEnabledTagRules(): Promise<TagRule[]> {
    const knex = getKnex();
    const query = knex('tag_rule')
      .select(TAG_RULE_COLUMNS)
      .join('tag', 'tag.tag_id', 'tag_rule.tag_id')
      .where('tag_rule.is_enabled', true)
      .whereNull('tag_rule.record_end_date')
      .whereNull('tag.record_end_date')
      .orderBy([
        { column: 'tag_rule.create_date', order: 'asc' },
        { column: 'tag_rule.tag_rule_id', order: 'asc' }
      ]);

    const response = await this.connection.knex(query, TagRule);

    return response.rows;
  }

  /**
   * Get the tag rules whose expression matches a ticket: a feature of one of its submission uploads matches the
   * expression, or one of its data requests' expressions refers to the same properties or taxa.
   *
   * One statement: each rule is a branch selecting its id from the ticket row when it matches, combined with
   * `UNION ALL`.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {TagRuleEvaluation[]} rules - Enabled rules to evaluate; at least one.
   * @param {TicketSubmissionUploadScope[]} uploads - The ticket's active submission uploads.
   * @returns {Promise<TagRuleId[]>} Identifiers of the matching rules.
   * @memberof TagRuleRepository
   */
  async getMatchingTagRuleIds(
    ticketId: string,
    rules: TagRuleEvaluation[],
    uploads: TicketSubmissionUploadScope[]
  ): Promise<TagRuleId[]> {
    const knex = getKnex();
    const branches = rules.map((rule) =>
      knex('ticket as t')
        .select(knex.raw('?::uuid AS tag_rule_id', [rule.tag_rule_id]))
        .where('t.ticket_id', ticketId)
        .whereNull('t.record_end_date')
        .where((builder) => {
          orWhereSubmissionUploadMatchesExpression(builder, rule.expression, uploads);
          orWhereDataRequestReferencesExpression(builder, rule.expression_id);
        })
    );
    const query = knex.unionAll(branches, true);

    const response = await this.connection.knex(query, TagRuleId);

    return response.rows;
  }

  /**
   * Insert a tag rule.
   *
   * @param {TagRulePayload} tagRule - Tag rule payload.
   * @returns {Promise<TagRule>} Created tag rule.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof TagRuleRepository
   */
  async insertTagRule(tagRule: TagRulePayload): Promise<TagRule> {
    const knex = getKnex();
    const query = knex('tag_rule')
      .insert({
        tag_id: tagRule.tag_id,
        name: tagRule.name,
        description: tagRule.description,
        is_enabled: tagRule.is_enabled,
        expression_id: tagRule.expression_id
      })
      .returning(TAG_RULE_RETURNING_COLUMNS);

    const response = await this.connection.knex(query, TagRule);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert tag rule', [
        'TagRuleRepository->insertTagRule',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an active tag rule.
   *
   * @param {string} tagRuleId - Tag rule UUID.
   * @param {TagRulePayload} tagRule - Tag rule payload.
   * @returns {Promise<TagRule>} Updated tag rule.
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof TagRuleRepository
   */
  async updateTagRule(tagRuleId: string, tagRule: TagRulePayload): Promise<TagRule> {
    const knex = getKnex();
    const query = knex('tag_rule')
      .update({
        tag_id: tagRule.tag_id,
        name: tagRule.name,
        description: tagRule.description,
        is_enabled: tagRule.is_enabled,
        expression_id: tagRule.expression_id
      })
      .where('tag_rule_id', tagRuleId)
      .whereNull('record_end_date')
      .returning(TAG_RULE_RETURNING_COLUMNS);

    const response = await this.connection.knex(query, TagRule);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update tag rule', [
        'TagRuleRepository->updateTagRule',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete an active tag rule.
   *
   * @param {string} tagRuleId - Tag rule UUID.
   * @returns {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof TagRuleRepository
   */
  async deleteTagRule(tagRuleId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('tag_rule')
      .update({ record_end_date: knex.fn.now() })
      .where('tag_rule_id', tagRuleId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete tag rule', [
        'TagRuleRepository->deleteTagRule',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }

  /**
   * Soft delete all active tag rules of a tag.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof TagRuleRepository
   */
  async deleteTagRulesByTagId(tagId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('tag_rule')
      .update({ record_end_date: knex.fn.now() })
      .where('tag_id', tagId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }
}
