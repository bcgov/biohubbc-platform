import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { TagRule, TagRuleDetail, TagRulePayload, TagRuleRequest } from '../models/tag-rule';
import { TagRuleRepository } from '../repositories/tag-rule-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { ExpressionTreeService } from './expression-tree-service';
import { TagService } from './tag-service';
import { TicketTagService } from './ticket-tag-service';

/**
 * Service for admin-only tag rule management. Every rule belongs to one tag, and every operation is scoped to it.
 */
export class TagRuleService extends DBService {
  tagRuleRepository: TagRuleRepository;
  ticketTagService: TicketTagService;
  tagService: TagService;
  expressionTreeService: ExpressionTreeService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.tagRuleRepository = new TagRuleRepository(connection);
    this.ticketTagService = new TicketTagService(connection);
    this.tagService = new TagService(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
  }

  /**
   * List a tag's active rules.
   *
   * @param {string} tagId - Tag UUID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination and sorting.
   * @returns {Promise<TagRule[]>} The tag's rules, ordered by name unless a sort is given.
   * @memberof TagRuleService
   */
  async getTagRules(tagId: string, pagination?: ApiPaginationOptions): Promise<TagRule[]> {
    return this.tagRuleRepository.getTagRules(tagId, pagination);
  }

  /**
   * Count a tag's active rules.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<number>} Number of the tag's rules.
   * @memberof TagRuleService
   */
  async getTagRulesCount(tagId: string): Promise<number> {
    return this.tagRuleRepository.getTagRulesCount(tagId);
  }

  /**
   * Get a rule of a tag with its expression, for editing.
   *
   * @param {string} tagId - Tag UUID the rule belongs to.
   * @param {string} tagRuleId - Tag rule UUID.
   * @returns {Promise<TagRuleDetail>} Tag rule with its expression tree.
   * @throws {ApiNotFoundError} If the tag has no such active rule.
   * @memberof TagRuleService
   */
  async getTagRule(tagId: string, tagRuleId: string): Promise<TagRuleDetail> {
    const tagRule = await this.tagRuleRepository.getTagRuleById(tagId, tagRuleId);
    const expression = await this.expressionTreeService.readExpressionTree(tagRule.expression_id);

    return { ...tagRule, expression };
  }

  /**
   * Create an enabled rule for a tag. It applies to tickets evaluated after it is created; existing tickets are not
   * re-evaluated.
   *
   * @param {string} tagId - Tag UUID.
   * @param {TagRuleRequest} tagRule - Tag rule payload.
   * @returns {Promise<TagRuleDetail>} Created tag rule.
   * @throws {ApiConflictError} If an active rule already has the same name (case-insensitive).
   * @throws {HTTP400} If the tag is unknown or deleted, or the expression is invalid.
   * @memberof TagRuleService
   */
  async createTagRule(tagId: string, tagRule: TagRuleRequest): Promise<TagRuleDetail> {
    await this.tagService.assertActiveTagIds([tagId]);
    await this.assertTagRuleNameAvailable(tagRule.name);

    const payload = await this.getTagRulePayload(tagRule);
    const created = await this.tagRuleRepository.insertTagRule(tagId, payload);

    return this.getTagRule(tagId, created.tag_rule_id);
  }

  /**
   * Update a rule's name, description and expression. Changes apply to tickets evaluated afterwards; tags already
   * applied are unaffected.
   *
   * @param {string} tagId - Tag UUID the rule belongs to.
   * @param {string} tagRuleId - Tag rule UUID.
   * @param {TagRuleRequest} tagRule - Tag rule payload.
   * @returns {Promise<TagRuleDetail>} Updated tag rule.
   * @throws {ApiNotFoundError} If the tag has no such active rule.
   * @throws {ApiConflictError} If another active rule already has the new name (case-insensitive).
   * @throws {HTTP400} If the expression is invalid.
   * @memberof TagRuleService
   */
  async updateTagRule(tagId: string, tagRuleId: string, tagRule: TagRuleRequest): Promise<TagRuleDetail> {
    await this.tagRuleRepository.getTagRuleById(tagId, tagRuleId);
    await this.assertTagRuleNameAvailable(tagRule.name, tagRuleId);

    const payload = await this.getTagRulePayload(tagRule);
    await this.tagRuleRepository.updateTagRule(tagId, tagRuleId, payload);

    return this.getTagRule(tagId, tagRuleId);
  }

  /**
   * Enable or disable a rule. Disabled rules are not evaluated; tags already applied are unaffected.
   *
   * @param {string} tagId - Tag UUID the rule belongs to.
   * @param {string} tagRuleId - Tag rule UUID.
   * @param {boolean} isEnabled - Whether the rule is evaluated.
   * @returns {Promise<TagRule>} Updated tag rule.
   * @throws {ApiNotFoundError} If the tag has no such active rule.
   * @memberof TagRuleService
   */
  async updateTagRuleEnabled(tagId: string, tagRuleId: string, isEnabled: boolean): Promise<TagRule> {
    await this.tagRuleRepository.getTagRuleById(tagId, tagRuleId);

    return this.tagRuleRepository.updateTagRuleEnabled(tagId, tagRuleId, isEnabled);
  }

  /**
   * Soft delete a rule, optionally removing the tags it applied. Removing them takes the tickets off the boards their tag
   * is linked to, except boards another of their tags is linked to.
   *
   * @param {string} tagId - Tag UUID the rule belongs to.
   * @param {string} tagRuleId - Tag rule UUID.
   * @param {boolean} removeTags - Whether to remove the rule's active tags from tickets.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the tag has no such active rule.
   * @memberof TagRuleService
   */
  async deleteTagRule(tagId: string, tagRuleId: string, removeTags: boolean): Promise<void> {
    await this.tagRuleRepository.getTagRuleById(tagId, tagRuleId);

    if (removeTags) {
      await this.ticketTagService.deleteTicketTagsByTagRuleId(tagRuleId);
    }

    await this.tagRuleRepository.deleteTagRule(tagId, tagRuleId);
  }

  /**
   * Resolve a tag rule request's expression into a stored expression id.
   *
   * @private
   * @param {TagRuleRequest} tagRule - Tag rule request.
   * @returns {Promise<TagRulePayload>} Columns to write.
   * @memberof TagRuleService
   */
  private async getTagRulePayload(tagRule: TagRuleRequest): Promise<TagRulePayload> {
    const expression = await this.expressionTreeService.writeExpressionTree(tagRule.expression);

    return {
      name: tagRule.name,
      description: tagRule.description,
      expression_id: expression.expression_id
    };
  }

  /**
   * Assert that no other active rule has the given name (case-insensitive).
   *
   * @private
   * @param {string} name - Tag rule name.
   * @param {string} [tagRuleId] - Rule being renamed, which may keep its own name.
   * @returns {Promise<void>}
   * @throws {ApiConflictError} If the name is taken by another active rule.
   * @memberof TagRuleService
   */
  private async assertTagRuleNameAvailable(name: string, tagRuleId?: string): Promise<void> {
    const existingTagRule = await this.tagRuleRepository.findTagRuleByName(name);

    if (existingTagRule && existingTagRule.tag_rule_id !== tagRuleId) {
      throw new ApiConflictError('A tag rule with this name already exists');
    }
  }
}
