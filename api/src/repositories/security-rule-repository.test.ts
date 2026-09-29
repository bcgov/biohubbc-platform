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

  describe('getScreenableSecurityRules', () => {
    it('returns active rules with their current expression ids', async () => {
      const rows = [
        { security_rule_id: 1, name: 'rule-a', expression_ids: ['2b7d1f7c-5d0f-4a46-a2c9-6f1f3a5d8e10'] },
        { security_rule_id: 2, name: 'rule-b', expression_ids: [] }
      ];
      const sql = sinon.stub().resolves({ rowCount: 2, rows });
      const repo = new SecurityRuleRepository(getMockDBConnection({ sql }));

      const result = await repo.getScreenableSecurityRules();

      const text = sql.firstCall.args[0].text as string;
      expect(text).to.include('sr.is_active = true');
      expect(text).to.include('sr.record_end_date IS NULL');
      expect(text).to.include('sc.record_end_date IS NULL');
      expect(text).to.include('sre.record_end_date IS NULL');
      expect(text).to.include('e.record_end_date IS NULL');
      expect(result).to.eql(rows);
    });
  });

  describe('getSecurityRulesWithCategory', () => {
    it('reads every requested rule with its category in one query', async () => {
      const rows = [
        { security_rule_id: 1, record_end_date: null, category_record_end_date: null },
        { security_rule_id: 2, record_end_date: '2026-02-01', category_record_end_date: null }
      ];
      const knex = sinon.stub().resolves({ rowCount: 2, rows });
      const repo = new SecurityRuleRepository(getMockDBConnection({ knex }));

      const result = await repo.getSecurityRulesWithCategory([1, 2]);

      expect(knex).to.have.been.calledOnce;
      const { sql, bindings } = knex.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('"sr"."security_rule_id" in ($1, $2)');
      expect(bindings).to.eql([1, 2]);
      expect(result).to.eql(rows);
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
      const result = await repo.deleteSecurityRule(1);

      expect(result).to.be.undefined;
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

    it('counts every current assignment, including automatic screening', async () => {
      let capturedSql = '';
      let capturedBindings: readonly unknown[] = [];
      const mockDBConnection = getMockDBConnection({
        knex: async (query: any) => {
          const compiled = query.toSQL().toNative();
          capturedSql = compiled.sql;
          capturedBindings = compiled.bindings;
          return { rowCount: 1, rows: [{ count: 0 }] } as any as Promise<QueryResult<any>>;
        }
      });

      const repo = new SecurityRuleRepository(mockDBConnection);
      await repo.getActiveAppliedFeatureCount(1);

      expect(capturedSql).not.to.contain('status');
      expect(capturedBindings).not.to.include('active');
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
