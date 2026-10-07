import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiValidationError } from '../errors/api-error';
import { SecurityRuleAndCategory } from '../models/security-rule';
import { SecurityCategoryRepository } from '../repositories/security-category-repository';
import { SecurityRuleRepository } from '../repositories/security-rule-repository';
import { SecurityRuleService } from './security-rule-service';

chai.use(sinonChai);

/**
 * Build a rule and category row as the assignment-validation lookup returns it, current unless overridden.
 *
 * @param {number} securityRuleId Rule identifier.
 * @param {Partial<SecurityRuleAndCategory>} [overrides] Fields to replace, such as an end date.
 * @returns {SecurityRuleAndCategory} The row.
 */
function ruleAndCategory(
  securityRuleId: number,
  overrides: Partial<SecurityRuleAndCategory> = {}
): SecurityRuleAndCategory {
  return {
    security_rule_id: securityRuleId,
    policy_id: null,
    name: `Rule ${securityRuleId}`,
    description: null,
    is_active: true,
    record_effective_date: '2026-01-01',
    record_end_date: null,
    security_category_id: 1,
    category_name: 'Category',
    category_description: null,
    category_record_effective_date: '2026-01-01',
    category_record_end_date: null,
    ...overrides
  };
}

/**
 * Assert that validating the requested rules rejects them as unavailable.
 *
 * @param {SecurityRuleService} service Service under test.
 * @param {number[]} securityRuleIds Rules requested for assignment.
 * @returns {Promise<void>} Resolves once the rejection has been checked.
 */
async function expectRulesUnavailable(service: SecurityRuleService, securityRuleIds: number[]): Promise<void> {
  try {
    await service.assertSecurityRulesValid(securityRuleIds);
    expect.fail('Expected the rules to be rejected');
  } catch (error) {
    expect(error).to.be.instanceOf(ApiValidationError);
    expect((error as ApiValidationError).message).to.equal('One or more security rules are unavailable.');
  }
}

describe('SecurityRuleService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getScreenableSecurityRules', () => {
    it('delegates to SecurityRuleRepository.getScreenableSecurityRules', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityRuleService(mockDBConnection);

      const mockRules = [
        {
          security_rule_id: 1,
          name: 'Victoria Rule',
          expression_ids: ['2b7d1f7c-5d0f-4a46-a2c9-6f1f3a5d8e10']
        }
      ];

      const stub = sinon.stub(SecurityRuleRepository.prototype, 'getScreenableSecurityRules').resolves(mockRules);

      const result = await service.getScreenableSecurityRules();

      expect(stub).to.have.been.calledOnce;
      expect(result).to.eql(mockRules);
    });
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
        security_category_id: 2,
        is_active: true
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
        await service.createSecurityRule({
          name: 'rule-a',
          description: 'desc',
          security_category_id: 999,
          is_active: true
        });
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

  describe('assertSecurityRulesValid', () => {
    it('resolves without a query when no rule is requested', async () => {
      const service = new SecurityRuleService(getMockDBConnection());
      const lookup = sinon.stub(SecurityRuleRepository.prototype, 'getSecurityRulesWithCategory');

      await service.assertSecurityRulesValid([]);

      expect(lookup).not.to.have.been.called;
    });

    it('reads every requested rule in one query and resolves when each rule and category is current', async () => {
      const service = new SecurityRuleService(getMockDBConnection());
      const lookup = sinon
        .stub(SecurityRuleRepository.prototype, 'getSecurityRulesWithCategory')
        .resolves([ruleAndCategory(1), ruleAndCategory(2)]);

      await service.assertSecurityRulesValid([1, 2, 1]);

      expect(lookup).to.have.been.calledOnceWithExactly([1, 2]);
    });

    it('rejects a request that includes a rule that does not exist', async () => {
      const service = new SecurityRuleService(getMockDBConnection());
      sinon.stub(SecurityRuleRepository.prototype, 'getSecurityRulesWithCategory').resolves([ruleAndCategory(1)]);

      await expectRulesUnavailable(service, [1, 2]);
    });

    it('rejects a rule that has ended', async () => {
      const service = new SecurityRuleService(getMockDBConnection());
      sinon
        .stub(SecurityRuleRepository.prototype, 'getSecurityRulesWithCategory')
        .resolves([ruleAndCategory(1), ruleAndCategory(2, { record_end_date: '2026-02-01' })]);

      await expectRulesUnavailable(service, [1, 2]);
    });

    it('rejects a rule whose category has ended', async () => {
      const service = new SecurityRuleService(getMockDBConnection());
      sinon
        .stub(SecurityRuleRepository.prototype, 'getSecurityRulesWithCategory')
        .resolves([ruleAndCategory(1, { category_record_end_date: '2026-02-01' })]);

      await expectRulesUnavailable(service, [1]);
    });
  });

  describe('assertSecurityRuleIsUnused', () => {
    it('resolves without error when count is 0', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityRuleService(mockDBConnection);

      const countStub = sinon.stub(SecurityRuleRepository.prototype, 'getActiveAppliedFeatureCount').resolves(0);

      const result = await service.assertSecurityRuleIsUnused(1);

      expect(countStub).to.have.been.calledOnceWith(1);
      expect(result).to.be.undefined;
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
