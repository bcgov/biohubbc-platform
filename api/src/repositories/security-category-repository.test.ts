import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { SecurityCategoryRepository } from './security-category-repository';

chai.use(sinonChai);

describe('SecurityCategoryRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSecurityCategory', () => {
    it('returns the inserted category', async () => {
      const mockRow = { security_category_id: 1, name: 'Health', description: 'Health category' };
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);
      const result = await repo.insertSecurityCategory({ name: 'Health', description: 'Health category' });

      expect(result).to.eql(mockRow);
    });

    it('throws ApiExecuteSQLError if rowCount !== 1', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);

      try {
        await repo.insertSecurityCategory({ name: 'Health', description: 'Health category' });
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to insert security category');
      }
    });
  });

  describe('getSecurityCategory', () => {
    it('returns the category when found', async () => {
      const mockRow = { security_category_id: 1, name: 'Health', description: 'Health category' };
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);
      const result = await repo.getSecurityCategory(1);

      expect(result).to.eql(mockRow);
    });

    it('throws ApiNotFoundError if not found', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);

      try {
        await repo.getSecurityCategory(999);
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Security category not found');
      }
    });
  });

  describe('updateSecurityCategory', () => {
    it('resolves without error on success', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);
      await repo.updateSecurityCategory(1, { name: 'Updated', description: 'Updated desc' });
    });

    it('throws ApiExecuteSQLError if rowCount !== 1', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);

      try {
        await repo.updateSecurityCategory(1, { name: 'Updated', description: 'Updated desc' });
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to update security category');
      }
    });
  });

  describe('deleteSecurityCategory', () => {
    it('resolves without error on success', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [{ security_category_id: 1 }] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);
      await repo.deleteSecurityCategory(1);
    });

    it('throws ApiExecuteSQLError if rowCount !== 1', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);

      try {
        await repo.deleteSecurityCategory(999);
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to delete security category');
      }
    });
  });

  describe('getActiveSecurityRuleCountByCategory', () => {
    it('returns the count of active rules', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [{ count: 3 }] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);
      const count = await repo.getActiveSecurityRuleCountByCategory(1);

      expect(count).to.equal(3);
    });

    it('throws ApiExecuteSQLError if rowCount !== 1', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>)
      });

      const repo = new SecurityCategoryRepository(mockDBConnection);

      try {
        await repo.getActiveSecurityRuleCountByCategory(1);
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to get security rule count for category');
      }
    });
  });
});
