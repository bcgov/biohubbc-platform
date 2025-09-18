import chai, { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../src/errors/api-error';
import { ContributorRepository } from '../../src/repositories/contributor-repository';
import { getMockDBConnection } from '../../src/__mocks__/db';

chai.use(sinonChai);

describe('ContributorRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createContributor', () => {
    it('returns contributor_id when insert succeeds', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ contributor_id: 42 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      const result = await repository.createContributor('my-client-id');

      expect(result).to.equal(42);
    });

    it('throws ApiExecuteSQLError when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      try {
        await repository.createContributor('my-client-id');
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Failed to create contributor');
      }
    });

    it('throws error when database query throws', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          throw new Error('DB failure');
        }
      });

      const repository = new ContributorRepository(mockDBConnection);

      try {
        await repository.createContributor('my-client-id');
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB failure');
      }
    });
  });

  describe('createContributorMember', () => {
    it('calls the SQL insert with correct params', async () => {
      const sqlSpy = sinon.stub().resolves({ rowCount: 1 });

      const mockDBConnection = getMockDBConnection({
        sql: sqlSpy
      });

      const repository = new ContributorRepository(mockDBConnection);

      await repository.createContributorMember(123, 456);

      expect(sqlSpy).to.have.been.calledOnce;
      const queryText = sqlSpy.getCall(0).args[0].text;
      expect(queryText).to.contain('INSERT INTO contributor_system_user');
      expect(queryText).to.contain('(contributor_id, system_user_id)');
    });

    it('throws error if insert fails (e.g., FK constraint)', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          throw new Error('insert or update on table "contributor_system_user" violates foreign key constraint');
        }
      });

      const repository = new ContributorRepository(mockDBConnection);

      try {
        await repository.createContributorMember(999, 999);
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.contain('violates foreign key constraint');
      }
    });
  });
});
