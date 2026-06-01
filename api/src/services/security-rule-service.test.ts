import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError } from '../errors/api-error';
import { SecurityCategoryRepository } from '../repositories/security-category-repository';
import { SecurityRuleRepository } from '../repositories/security-rule-repository';
import { SecurityRuleService } from './security-rule-service';

chai.use(sinonChai);

describe('SecurityRuleService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createSecurityRule', () => {
    it('validates the category exists and inserts the rule', async () => {
      const mockCategory = { security_category_id: 2, name: 'Health', description: 'Health category' };
      const mockRule = { security_rule_id: 1, security_category_id: 2, name: 'rule-a', description: 'desc' };

      const mockDBConnection = getMockDBConnection();
      const service = new SecurityRuleService(mockDBConnection);

      const getCategoryStub = sinon
        .stub(SecurityCategoryRepository.prototype, 'getSecurityCategory')
        .resolves(mockCategory);
      const insertStub = sinon.stub(SecurityRuleRepository.prototype, 'insertSecurityRule').resolves(mockRule);

      const result = await service.createSecurityRule({
        name: 'rule-a',
        description: 'desc',
        security_category_id: 2
      });

      expect(getCategoryStub).to.have.been.calledOnceWith(2);
      expect(insertStub).to.have.been.calledOnce;
      expect(result).to.eql(mockRule);
    });

    it('throws when the referenced category does not exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityRuleService(mockDBConnection);

      sinon
        .stub(SecurityCategoryRepository.prototype, 'getSecurityCategory')
        .rejects(new Error('Security category not found'));
      const insertStub = sinon.stub(SecurityRuleRepository.prototype, 'insertSecurityRule').resolves();

      try {
        await service.createSecurityRule({ name: 'rule-a', description: 'desc', security_category_id: 999 });
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Security category not found');
        expect(insertStub).to.not.have.been.called;
      }
    });
  });

  describe('updateSecurityRule', () => {
    it('validates the category, updates the rule, and returns the refreshed record', async () => {
      const mockCategory = { security_category_id: 2, name: 'Health', description: 'Health category' };
      const mockRule = { security_rule_id: 1, security_category_id: 2, name: 'updated', description: 'desc' };

      const mockDBConnection = getMockDBConnection();
      const service = new SecurityRuleService(mockDBConnection);

      const getCategoryStub = sinon
        .stub(SecurityCategoryRepository.prototype, 'getSecurityCategory')
        .resolves(mockCategory);
      const updateStub = sinon.stub(SecurityRuleRepository.prototype, 'updateSecurityRule').resolves();
      const getStub = sinon.stub(SecurityRuleRepository.prototype, 'getSecurityRule').resolves(mockRule);

      const result = await service.updateSecurityRule(1, {
        name: 'updated',
        description: 'desc',
        security_category_id: 2
      });

      expect(getCategoryStub).to.have.been.calledOnceWith(2);
      expect(updateStub).to.have.been.calledOnce;
      expect(getStub).to.have.been.calledOnceWith(1);
      expect(result).to.eql(mockRule);
    });
  });

  describe('assertSecurityRuleIsUnused', () => {
    it('resolves without error when count is 0', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityRuleService(mockDBConnection);

      sinon.stub(SecurityRuleRepository.prototype, 'getActiveAppliedFeatureCount').resolves(0);

      await service.assertSecurityRuleIsUnused(1);
    });

    it('throws ApiConflictError when count > 0', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityRuleService(mockDBConnection);

      sinon.stub(SecurityRuleRepository.prototype, 'getActiveAppliedFeatureCount').resolves(3);

      try {
        await service.assertSecurityRuleIsUnused(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect((error as ApiConflictError).message).to.equal(
          'Cannot delete a security rule that is still applied to one or more features'
        );
      }
    });
  });

  describe('deleteSecurityRule', () => {
    it('deletes the rule when it has no active applications', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityRuleService(mockDBConnection);

      const countStub = sinon.stub(SecurityRuleRepository.prototype, 'getActiveAppliedFeatureCount').resolves(0);
      const deleteStub = sinon.stub(SecurityRuleRepository.prototype, 'deleteSecurityRule').resolves();

      await service.deleteSecurityRule(1);

      expect(countStub).to.have.been.calledOnceWith(1);
      expect(deleteStub).to.have.been.calledOnceWith(1);
    });

    it('throws ApiConflictError and does not delete when active applications exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityRuleService(mockDBConnection);

      sinon.stub(SecurityRuleRepository.prototype, 'getActiveAppliedFeatureCount').resolves(2);
      const deleteStub = sinon.stub(SecurityRuleRepository.prototype, 'deleteSecurityRule').resolves();

      try {
        await service.deleteSecurityRule(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect(deleteStub).to.not.have.been.called;
      }
    });
  });
});
