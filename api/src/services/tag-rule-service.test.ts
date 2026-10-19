import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError } from '../errors/api-error';
import { TagRule, TagRuleRequest, TagRuleSummary } from '../models/tag-rule';
import { TagRuleRepository } from '../repositories/tag-rule-repository';
import { TicketTagRepository } from '../repositories/ticket-tag-repository';
import { ExpressionTreeService } from './expression-tree-service';
import { TagRuleService } from './tag-rule-service';
import { TagService } from './tag-service';

chai.use(sinonChai);

const tagRuleId = '11111111-1111-1111-1111-111111111111';

const request: TagRuleRequest = {
  tagId: '22222222-2222-2222-2222-222222222222',
  name: 'Needs Review',
  description: null,
  isEnabled: true,
  expression: { type: 'expression', operator: 'AND', clauses: [] } as any
};

const tagRule: TagRule = {
  tag_rule_id: tagRuleId,
  tag_id: request.tagId,
  name: request.name,
  description: null,
  is_enabled: true,
  expression_id: 'expr',
  create_date: '2026-10-20T00:00:00.000Z'
};

const tagRuleSummary: TagRuleSummary = { ...tagRule, tag_name: 'Needs Review', tag_color: '#000000' };

describe('TagRuleService', () => {
  let service: TagRuleService;

  beforeEach(() => {
    service = new TagRuleService(getMockDBConnection());
    sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(request.expression);
    sinon.stub(TagService.prototype, 'assertActiveTagIds').resolves();
    sinon.stub(TagRuleRepository.prototype, 'getTagRuleById').resolves(tagRuleSummary);
  });

  afterEach(() => sinon.restore());

  describe('createTagRule', () => {
    it('stores the expression and maps the request to columns', async () => {
      sinon.stub(TagRuleRepository.prototype, 'findTagRuleByName').resolves(undefined);
      const writeStub = sinon
        .stub(ExpressionTreeService.prototype, 'writeExpressionTree')
        .resolves({ expression_id: 'expr' });
      const insertStub = sinon.stub(TagRuleRepository.prototype, 'insertTagRule').resolves(tagRule);

      const result = await service.createTagRule(request);

      expect(insertStub).to.have.been.calledOnceWith({
        tag_id: request.tagId,
        name: request.name,
        description: null,
        is_enabled: true,
        expression_id: 'expr'
      });
      expect(writeStub).to.have.been.calledOnceWith(request.expression);
      expect(result).to.eql({ ...tagRuleSummary, expression: request.expression });
    });

    it('rejects a duplicate active name before writing', async () => {
      sinon.stub(TagRuleRepository.prototype, 'findTagRuleByName').resolves({ tag_rule_id: 'other' });
      const insertStub = sinon.stub(TagRuleRepository.prototype, 'insertTagRule');

      try {
        await service.createTagRule(request);
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(insertStub).to.not.have.been.called;
    });
  });

  describe('deleteTagRule', () => {
    it('removes the rule tags only when asked', async () => {
      const removeTagsStub = sinon.stub(TicketTagRepository.prototype, 'deleteTicketTagsByTagRuleId').resolves();
      const deleteStub = sinon.stub(TagRuleRepository.prototype, 'deleteTagRule').resolves();

      await service.deleteTagRule(tagRuleId, false);
      expect(removeTagsStub).to.not.have.been.called;

      await service.deleteTagRule(tagRuleId, true);
      expect(removeTagsStub).to.have.been.calledOnceWith(tagRuleId);
      expect(deleteStub).to.have.been.calledTwice;
    });
  });
});
