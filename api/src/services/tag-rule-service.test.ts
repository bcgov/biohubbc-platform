import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError } from '../errors/api-error';
import { TagRule, TagRuleRequest } from '../models/tag-rule';
import { TagRuleRepository } from '../repositories/tag-rule-repository';
import { TicketTagRepository } from '../repositories/ticket-tag-repository';
import { ExpressionTreeService } from './expression-tree-service';
import { TagRuleService } from './tag-rule-service';
import { TagService } from './tag-service';

chai.use(sinonChai);

const tagId = '22222222-2222-2222-2222-222222222222';
const tagRuleId = '11111111-1111-1111-1111-111111111111';

const request: TagRuleRequest = {
  name: 'Fish',
  description: null,
  expression: { type: 'expression', operator: 'AND', clauses: [] } as any
};

const tagRule: TagRule = {
  tag_rule_id: tagRuleId,
  tag_id: tagId,
  name: request.name,
  description: null,
  is_enabled: true,
  expression_id: 'expr',
  create_date: '2026-10-20T00:00:00.000Z'
};

describe('TagRuleService', () => {
  let service: TagRuleService;

  beforeEach(() => {
    service = new TagRuleService(getMockDBConnection());
    sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(request.expression);
    sinon.stub(TagService.prototype, 'assertActiveTagIds').resolves();
  });

  afterEach(() => sinon.restore());

  describe('createTagRule', () => {
    it("stores the expression and creates the rule for the route's tag", async () => {
      sinon.stub(TagRuleRepository.prototype, 'findTagRuleByName').resolves(undefined);
      const writeStub = sinon
        .stub(ExpressionTreeService.prototype, 'writeExpressionTree')
        .resolves({ expression_id: 'expr' });
      const insertStub = sinon.stub(TagRuleRepository.prototype, 'insertTagRule').resolves(tagRule);
      sinon.stub(TagRuleRepository.prototype, 'getTagRuleById').resolves(tagRule);

      const result = await service.createTagRule(tagId, request);

      expect(writeStub).to.have.been.calledOnceWith(request.expression);
      expect(insertStub).to.have.been.calledOnceWith(tagId, { name: 'Fish', description: null, expression_id: 'expr' });
      expect(result).to.eql({ ...tagRule, expression: request.expression });
    });

    it('rejects a duplicate active name before writing', async () => {
      sinon.stub(TagRuleRepository.prototype, 'findTagRuleByName').resolves({ tag_rule_id: 'other' });
      const insertStub = sinon.stub(TagRuleRepository.prototype, 'insertTagRule');

      try {
        await service.createTagRule(tagId, request);
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(insertStub).to.not.have.been.called;
    });
  });

  describe('rule scope', () => {
    it("rejects updating, enabling, or deleting a rule that is not the tag's without writing", async () => {
      sinon.stub(TagRuleRepository.prototype, 'getTagRuleById').rejects(new ApiNotFoundError('Tag rule not found'));
      const updateStub = sinon.stub(TagRuleRepository.prototype, 'updateTagRule');
      const enabledStub = sinon.stub(TagRuleRepository.prototype, 'updateTagRuleEnabled');
      const deleteStub = sinon.stub(TagRuleRepository.prototype, 'deleteTagRule');

      const attempts = [
        () => service.updateTagRule(tagId, tagRuleId, request),
        () => service.updateTagRuleEnabled(tagId, tagRuleId, false),
        () => service.deleteTagRule(tagId, tagRuleId, true)
      ];

      for (const attempt of attempts) {
        try {
          await attempt();
          expect.fail('Expected not found');
        } catch (error) {
          expect(error).to.be.instanceOf(ApiNotFoundError);
        }
      }

      expect(updateStub).to.not.have.been.called;
      expect(enabledStub).to.not.have.been.called;
      expect(deleteStub).to.not.have.been.called;
    });
  });

  describe('updateTagRuleEnabled', () => {
    it('enables or disables the rule', async () => {
      sinon.stub(TagRuleRepository.prototype, 'getTagRuleById').resolves(tagRule);
      const enabledStub = sinon
        .stub(TagRuleRepository.prototype, 'updateTagRuleEnabled')
        .resolves({ ...tagRule, is_enabled: false });

      const result = await service.updateTagRuleEnabled(tagId, tagRuleId, false);

      expect(enabledStub).to.have.been.calledOnceWith(tagId, tagRuleId, false);
      expect(result.is_enabled).to.be.false;
    });
  });

  describe('deleteTagRule', () => {
    it('removes the rule tags only when asked', async () => {
      sinon.stub(TagRuleRepository.prototype, 'getTagRuleById').resolves(tagRule);
      const removeTagsStub = sinon.stub(TicketTagRepository.prototype, 'deleteTicketTagsByTagRuleId').resolves();
      const deleteStub = sinon.stub(TagRuleRepository.prototype, 'deleteTagRule').resolves();

      await service.deleteTagRule(tagId, tagRuleId, false);
      expect(removeTagsStub).to.not.have.been.called;

      await service.deleteTagRule(tagId, tagRuleId, true);
      expect(removeTagsStub).to.have.been.calledOnceWith(tagRuleId);
      expect(deleteStub).to.have.been.calledTwice;
      expect(deleteStub).to.have.been.calledWith(tagId, tagRuleId);
    });
  });
});
