import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { ContributorCodesetRepository } from './contributor-codeset-repository';

chai.use(sinonChai);

describe('ContributorCodesetRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getCodesets', () => {
    it('returns formatted codeset response', async () => {
      const mockResponse = {
        rows: [{ result: { categories: [{ name: 'category1', codes: [] }] } }]
      } as any as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({
        knex: async () => mockResponse
      });

      const repo = new ContributorCodesetRepository(mockConnection);

      const result = await repo.getCodesets({ contributor_id: 1 });

      expect(result).to.eql({ categories: [{ name: 'category1', codes: [] }] });
    });

    it('throws if knex query fails', async () => {
      const mockConnection = getMockDBConnection({
        knex: sinon.stub().throws(new Error('Query failed'))
      });

      const repo = new ContributorCodesetRepository(mockConnection);

      try {
        await repo.getCodesets({ contributor_id: 1 });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Query failed');
      }
    });
  });

  describe('createCodesetCategory', () => {
    it('builds and executes correct SQL', async () => {
      const fakeSql = sinon.fake.resolves({ rowCount: 1 });
      const mockConnection = getMockDBConnection({ sql: fakeSql });

      const repo = new ContributorCodesetRepository(mockConnection);

      const category = {
        name: 'status',
        description: 'Status category',
        codes: [
          { label: 'active', value: '1', description: 'Active record' },
          { label: 'inactive', value: '0', description: 'Inactive record' }
        ]
      };

      await repo.createCodesetCategory(42, category);

      expect(fakeSql).to.have.been.calledOnce;
    });

    it('throws if SQL execution fails', async () => {
      const mockConnection = getMockDBConnection({
        sql: sinon.stub().throws(new Error('Insert failed'))
      });

      const repo = new ContributorCodesetRepository(mockConnection);

      try {
        await repo.createCodesetCategory(1, {
          name: 'type',
          description: 'Test',
          codes: [{ label: 'test', value: 'x' }]
        });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Insert failed');
      }
    });
  });
});
