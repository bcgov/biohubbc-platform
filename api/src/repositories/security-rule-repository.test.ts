import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { SecurityRuleRepository } from './security-rule-repository';

chai.use(sinonChai);

describe('SecurityRuleRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getActiveSecurityRules', () => {
    it('returns an array of security rules', async () => {
      const mockRow = {
        security_rule_id: 1,
        policy_id: null,
        name: 'rule-a',
        description: 'desc',
        record_effective_date: '2024-01-01',
        record_end_date: null,
        create_date: '2024-01-01',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 0
      };
      const mockDBConnection = getMockDBConnection({
        sql: async () => ({ rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      const result = await repo.getActiveSecurityRules();

      expect(result).to.have.length(1);
    });

    it('returns an empty array when there are no active rules', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      const result = await repo.getActiveSecurityRules();

      expect(result).to.eql([]);
    });
  });

  describe('getSecurityRulesWithFeatureCount', () => {
    it('counts only non-soft-deleted applications', async () => {
      const mockRow = {
        security_rule_id: 1,
        security_category_id: 2,
        category_name: 'Health',
        name: 'rule-a',
        description: 'desc',
        feature_count: 5
      };
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      const result = await repo.getSecurityRulesWithFeatureCount();

      expect(result).to.have.length(1);
      expect(result[0].feature_count).to.equal(5);
    });

    it('returns feature_count of 0 when no active applications exist', async () => {
      const mockRow = {
        security_rule_id: 1,
        security_category_id: 2,
        category_name: 'Health',
        name: 'rule-a',
        description: 'desc',
        feature_count: 0
      };
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      const result = await repo.getSecurityRulesWithFeatureCount();

      expect(result[0].feature_count).to.equal(0);
    });
  });

  describe('insertSecurityRule', () => {
    it('returns the inserted rule', async () => {
      const mockRow = { security_rule_id: 1, security_category_id: 2, name: 'rule-a', description: 'desc' };
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      const result = await repo.insertSecurityRule({ name: 'rule-a', description: 'desc', security_category_id: 2 });

      expect(result).to.eql(mockRow);
    });

    it('throws ApiExecuteSQLError if rowCount !== 1', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);

      try {
        await repo.insertSecurityRule({ name: 'rule-a', description: 'desc', security_category_id: 2 });
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to insert security rule');
      }
    });
  });

  describe('getSecurityRule', () => {
    it('returns the rule when found', async () => {
      const mockRow = { security_rule_id: 1, security_category_id: 2, name: 'rule-a', description: 'desc' };
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      const result = await repo.getSecurityRule(1);

      expect(result).to.eql(mockRow);
    });

    it('throws ApiNotFoundError if not found', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);

      try {
        await repo.getSecurityRule(999);
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Security rule not found');
      }
    });
  });

  describe('deleteSecurityRule', () => {
    it('resolves without error on success', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [{ security_rule_id: 1 }] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      await repo.deleteSecurityRule(1);
    });

    it('throws ApiExecuteSQLError if rowCount !== 1', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);

      try {
        await repo.deleteSecurityRule(999);
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to delete security rule');
      }
    });
  });

  describe('getActiveAppliedFeatureCount', () => {
    it('returns the count of active applications', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [{ count: 4 }] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      const count = await repo.getActiveAppliedFeatureCount(1);

      expect(count).to.equal(4);
    });

    it('returns 0 when no active applications exist', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [{ count: 0 }] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      const count = await repo.getActiveAppliedFeatureCount(1);

      expect(count).to.equal(0);
    });

    it('throws ApiExecuteSQLError if rowCount !== 1', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityRuleRepository(mockDBConnection);

      try {
        await repo.getActiveAppliedFeatureCount(1);
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal(
          'Failed to get active applied feature count for security rule'
        );
      }
    });
  });
});
