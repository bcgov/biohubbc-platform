import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { TagRuleDetail, TagRulePayload, TagRuleRequest, TagRuleSummary } from '../models/tag-rule';
import { TagRuleRepository } from '../repositories/tag-rule-repository';
import { TicketTagRepository } from '../repositories/ticket-tag-repository';
import { DBService } from './db-service';
import { ExpressionTreeService } from './expression-tree-service';
import { TagService } from './tag-service';

/**
 * Service for admin-only tag rule management.
 */
export class TagRuleService extends DBService {
  tagRuleRepository: TagRuleRepository;
  ticketTagRepository: TicketTagRepository;
  tagService: TagService;
  expressionTreeService: ExpressionTreeService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.tagRuleRepository = new TagRuleRepository(connection);
    this.ticketTagRepository = new TicketTagRepository(connection);
    this.tagService = new TagService(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
  }

  /**
   * List active tag rules.
   *
   * @returns {Promise<TagRuleSummary[]>} Active tag rules ordered by name.
   * @memberof TagRuleService
   */
  async getTagRules(): Promise<TagRuleSummary[]> {
    return this.tagRuleRepository.getTagRules();
  }

  /**
   * Get a tag rule with its expression, for editing.
   *
   * @param {string} tagRuleId - Tag rule UUID.
   * @returns {Promise<TagRuleDetail>} Tag rule with its expression tree.
   * @throws {ApiNotFoundError} If the rule does not exist or is deleted.
   * @memberof TagRuleService
   */
  async getTagRule(tagRuleId: string): Promise<TagRuleDetail> {
    const tagRule = await this.tagRuleRepository.getTagRuleById(tagRuleId);
    const expression = await this.expressionTreeService.readExpressionTree(tagRule.expression_id);

    return { ...tagRule, expression };
  }

  /**
   * Create a tag rule. It applies to tickets evaluated after it is created; existing tickets are not re-evaluated.
   *
   * @param {TagRuleRequest} tagRule - Tag rule payload.
   * @returns {Promise<TagRuleDetail>} Created tag rule.
   * @throws {ApiConflictError} If an active rule already has the same name (case-insensitive).
   * @throws {HTTP400} If the tag is unknown or deleted, or the expression is invalid.
   * @memberof TagRuleService
   */
  async createTagRule(tagRule: TagRuleRequest): Promise<TagRuleDetail> {
    await this.assertTagRuleNameAvailable(tagRule.name);

    const payload = await this.getTagRulePayload(tagRule);
    const created = await this.tagRuleRepository.insertTagRule(payload);

    return this.getTagRule(created.tag_rule_id);
  }

  /**
   * Update a tag rule. Changes apply to tickets evaluated afterwards; tags already applied are unaffected.
   *
   * @param {string} tagRuleId - Tag rule UUID.
   * @param {TagRuleRequest} tagRule - Tag rule payload.
   * @returns {Promise<TagRuleDetail>} Updated tag rule.
   * @throws {ApiNotFoundError} If the rule does not exist or is deleted.
   * @throws {ApiConflictError} If another active rule already has the new name (case-insensitive).
   * @throws {HTTP400} If the tag is unknown or deleted, or the expression is invalid.
   * @memberof TagRuleService
   */
  async updateTagRule(tagRuleId: string, tagRule: TagRuleRequest): Promise<TagRuleDetail> {
    await this.tagRuleRepository.getTagRuleById(tagRuleId);
    await this.assertTagRuleNameAvailable(tagRule.name, tagRuleId);

    const payload = await this.getTagRulePayload(tagRule);
    await this.tagRuleRepository.updateTagRule(tagRuleId, payload);

    return this.getTagRule(tagRuleId);
  }

  /**
   * Soft delete a tag rule, optionally removing the tags it applied.
   *
   * @param {string} tagRuleId - Tag rule UUID.
   * @param {boolean} removeTags - Whether to remove the rule's active tags from tickets.
   * @returns {Promise<void>}
   * @throws {ApiNotFoundError} If the rule does not exist or is deleted.
   * @memberof TagRuleService
   */
  async deleteTagRule(tagRuleId: string, removeTags: boolean): Promise<void> {
    await this.tagRuleRepository.getTagRuleById(tagRuleId);

    if (removeTags) {
      await this.ticketTagRepository.deleteTicketTagsByTagRuleId(tagRuleId);
    }

    await this.tagRuleRepository.deleteTagRule(tagRuleId);
  }

  /**
   * Validate a tag rule request and resolve its expression into a stored expression id.
   *
   * @private
   * @param {TagRuleRequest} tagRule - Tag rule request.
   * @returns {Promise<TagRulePayload>} Columns to write.
   * @memberof TagRuleService
   */
  private async getTagRulePayload(tagRule: TagRuleRequest): Promise<TagRulePayload> {
    await this.tagService.assertActiveTagIds([tagRule.tagId]);

    const expression = await this.expressionTreeService.writeExpressionTree(tagRule.expression);

    return {
      tag_id: tagRule.tagId,
      name: tagRule.name,
      description: tagRule.description,
      is_enabled: tagRule.isEnabled,
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
