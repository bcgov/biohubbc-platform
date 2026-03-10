import chai, { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../src/errors/api-error';
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

  describe('findContributorByClientId', () => {
    it('returns contributor when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ contributor_id: 42, client_id: 'my-client-id' }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      const result = await repository.findContributorByClientId('my-client-id');

      expect(result).to.eql({ contributor_id: 42, client_id: 'my-client-id' });
    });

    it('returns null when contributor not found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      const result = await repository.findContributorByClientId('non-existent-client-id');

      expect(result).to.equal(null);
    });
  });

  describe('getContributorByClientId', () => {
    it('returns contributor when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ contributor_id: 42, client_id: 'my-client-id' }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      const result = await repository.getContributorByClientId('my-client-id');

      expect(result).to.eql({ contributor_id: 42, client_id: 'my-client-id' });
    });

    it('throws ApiNotFoundError when contributor not found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      try {
        await repository.getContributorByClientId('non-existent-client-id');
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect((err as ApiNotFoundError).message).to.equal('Contributor not found');
      }
    });
  });
});
