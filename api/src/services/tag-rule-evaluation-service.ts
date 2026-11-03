import { IDBConnection } from '../database/db';
import { TagRule, TagRuleEvaluation } from '../models/tag-rule';
import { publishEvaluateTicketTagRulesJob } from '../queue/publisher';
import { TagRuleRepository } from '../repositories/tag-rule-repository';
import { SubmissionUploadRepository } from '../repositories/upload/submission-upload-repository';
import { optimizeExpression } from '../utils/expression-optimization';
import { DBService } from './db-service';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { ExpressionTreeService } from './expression-tree-service';
import { TicketTagService } from './ticket-tag-service';

/**
 * Service that evaluates tag rules against a ticket.
 *
 * A ticket is evaluated when everything its rules can match on is known: when a data request is linked to it, and when
 * its submission upload's features are indexed. Callers queue the evaluation with
 * `publishEvaluateTicketTagRulesJob(connection, { ticketId })` inside their transaction, so the job is only queued if
 * the change commits.
 */
export class TagRuleEvaluationService extends DBService {
  static readonly dependencies = {
    publishEvaluateTicketTagRulesJob
  };

  tagRuleRepository: TagRuleRepository;
  submissionUploadRepository: SubmissionUploadRepository;
  ticketTagService: TicketTagService;
  expressionTreeService: ExpressionTreeService;
  expressionTreeNormalizationService: ExpressionTreeNormalizationService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.tagRuleRepository = new TagRuleRepository(connection);
    this.submissionUploadRepository = new SubmissionUploadRepository(connection);
    this.ticketTagService = new TicketTagService(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
    this.expressionTreeNormalizationService = new ExpressionTreeNormalizationService(connection);
  }

  /**
   * Evaluate the enabled tag rules against a ticket and add the tags of the rules that match.
   *
   * A rule matches when a feature of the ticket's submission upload matches its expression, or when the ticket's data
   * request expression refers to a property, or a taxon (including descendants), that the rule's expression refers to.
   *
   * Rules only add tags, and never a tag the ticket has ever had: an active tag is not added twice, and a removed tag
   * stays removed when the ticket is re-evaluated (for example after a reindex), whichever rule or admin added it.
   * Evaluation is idempotent, so retried and duplicate jobs are harmless. A tag a rule adds puts the ticket on the boards
   * linked to it, in their default lanes, like a tag added by hand.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<void>}
   * @memberof TagRuleEvaluationService
   */
  async evaluateTicketTagRules(ticketId: string): Promise<void> {
    const rules = await this.tagRuleRepository.getEnabledTagRules();

    if (!rules.length) {
      return;
    }

    const [evaluations, uploads] = await Promise.all([
      Promise.all(rules.map((rule) => this.getTagRuleEvaluation(rule))),
      this.submissionUploadRepository.getActiveSubmissionUploadScopesByTicketId(ticketId)
    ]);

    const matches = await this.tagRuleRepository.getMatchingTagRuleIds(ticketId, evaluations, uploads);
    const matchingTagRuleIds = new Set(matches.map((match) => match.tag_rule_id));
    const ruleTicketTags = rules
      .filter((rule) => matchingTagRuleIds.has(rule.tag_rule_id))
      .map((rule) => ({ tag_id: rule.tag_id, tag_rule_id: rule.tag_rule_id }));

    if (!ruleTicketTags.length) {
      return;
    }

    await this.ticketTagService.insertRuleTicketTags(ticketId, ruleTicketTags);
  }

  /**
   * Prepare a rule for evaluation, reading and normalizing its expression for upload feature matching.
   *
   * @private
   * @param {TagRule} rule - Tag rule.
   * @returns {Promise<TagRuleEvaluation>} Rule expression id and normalized expression.
   * @memberof TagRuleEvaluationService
   */
  private async getTagRuleEvaluation(rule: TagRule): Promise<TagRuleEvaluation> {
    const tree = await this.expressionTreeService.readExpressionTree(rule.expression_id);
    const normalized = await this.expressionTreeNormalizationService.normalize(tree);

    return {
      tag_rule_id: rule.tag_rule_id,
      expression_id: rule.expression_id,
      expression: optimizeExpression(normalized)
    };
  }
}
