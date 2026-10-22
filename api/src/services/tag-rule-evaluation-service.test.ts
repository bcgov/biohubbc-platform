import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { TagRule } from '../models/tag-rule';
import { BoardTicketRepository } from '../repositories/board-ticket-repository';
import { TagRuleRepository } from '../repositories/tag-rule-repository';
import { TicketTagRepository } from '../repositories/ticket-tag-repository';
import { SubmissionUploadRepository } from '../repositories/upload/submission-upload-repository';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { ExpressionTreeService } from './expression-tree-service';
import { TagRuleEvaluationService } from './tag-rule-evaluation-service';

chai.use(sinonChai);

const ticketId = '99999999-9999-9999-9999-999999999999';

const makeRule = (tagRuleId: string, tagId: string): TagRule => ({
  tag_rule_id: tagRuleId,
  tag_id: tagId,
  name: `Rule ${tagRuleId}`,
  description: null,
  is_enabled: true,
  expression_id: `expression-${tagRuleId}`,
  create_date: '2026-10-20T00:00:00.000Z'
});

describe('TagRuleEvaluationService', () => {
  const tree = { type: 'expression', operator: 'AND', clauses: [] } as any;

  beforeEach(() => {
    sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(tree);
    sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize').resolves(tree);
  });

  afterEach(() => sinon.restore());

  describe('evaluateTicketTagRules', () => {
    it('adds the tag of each matching rule with the rule that matched', async () => {
      sinon
        .stub(TagRuleRepository.prototype, 'getEnabledTagRules')
        .resolves([makeRule('r1', 'tag-a'), makeRule('r2', 'tag-b'), makeRule('r3', 'tag-c')]);
      const matchStub = sinon
        .stub(TagRuleRepository.prototype, 'getMatchingTagRuleIds')
        .resolves([{ tag_rule_id: 'r1' }, { tag_rule_id: 'r3' }]);
      const uploads = [{ submission_id: 1, submission_upload_id: 'upload-1' }];
      sinon.stub(SubmissionUploadRepository.prototype, 'getActiveSubmissionUploadScopesByTicketId').resolves(uploads);
      // The ticket once had tag-c, so the rule adds only tag-a.
      const insertStub = sinon
        .stub(TicketTagRepository.prototype, 'insertRuleTicketTags')
        .resolves([{ tag_id: 'tag-a' }]);
      const boardTicketsStub = sinon.stub(BoardTicketRepository.prototype, 'insertBoardTicketsByTagIds').resolves();

      await new TagRuleEvaluationService(getMockDBConnection()).evaluateTicketTagRules(ticketId);

      expect(matchStub).to.have.been.calledOnceWith(ticketId, sinon.match.array, uploads);
      // Each rule is matched by its stored expression id (data requests) and normalized expression (upload features).
      expect(matchStub.firstCall.args[1].map((rule: { expression_id: string }) => rule.expression_id)).to.eql([
        'expression-r1',
        'expression-r2',
        'expression-r3'
      ]);
      expect(insertStub).to.have.been.calledOnceWith(ticketId, [
        { tag_id: 'tag-a', tag_rule_id: 'r1' },
        { tag_id: 'tag-c', tag_rule_id: 'r3' }
      ]);
      // Only the tags the rules added put the ticket on boards.
      expect(boardTicketsStub).to.have.been.calledOnceWith(ticketId, ['tag-a']);
    });

    it('writes nothing when no rule matches', async () => {
      sinon.stub(TagRuleRepository.prototype, 'getEnabledTagRules').resolves([makeRule('r1', 'tag-a')]);
      sinon.stub(TagRuleRepository.prototype, 'getMatchingTagRuleIds').resolves([]);
      sinon.stub(SubmissionUploadRepository.prototype, 'getActiveSubmissionUploadScopesByTicketId').resolves([]);
      const insertStub = sinon.stub(TicketTagRepository.prototype, 'insertRuleTicketTags');

      await new TagRuleEvaluationService(getMockDBConnection()).evaluateTicketTagRules(ticketId);

      expect(insertStub).to.not.have.been.called;
    });

    it('does not query the ticket without enabled rules', async () => {
      sinon.stub(TagRuleRepository.prototype, 'getEnabledTagRules').resolves([]);
      const matchStub = sinon.stub(TagRuleRepository.prototype, 'getMatchingTagRuleIds');
      const uploadsStub = sinon.stub(SubmissionUploadRepository.prototype, 'getActiveSubmissionUploadScopesByTicketId');

      await new TagRuleEvaluationService(getMockDBConnection()).evaluateTicketTagRules(ticketId);

      expect(matchStub).to.not.have.been.called;
      expect(uploadsStub).to.not.have.been.called;
    });
  });
});
