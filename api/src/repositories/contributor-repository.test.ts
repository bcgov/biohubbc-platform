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

    it('throws ApiExecuteSQLError when duplicate rows are returned', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          { contributor_id: 1, client_id: 'a' },
          { contributor_id: 2, client_id: 'b' }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      try {
        await repository.findContributorByClientId('duplicate-client-id');
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Unexpected row count');
      }
    });
  });

  describe('getContributorBySubmissionUploadId', () => {
    it('returns contributor when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ contributor_id: 42, client_id: 'my-client-id' }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      const result = await repository.getContributorBySubmissionUploadId('00000000-0000-0000-0000-000000000001');

      expect(result).to.eql({ contributor_id: 42, client_id: 'my-client-id' });
    });

    it('throws ApiNotFoundError when contributor not found for submission upload', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      try {
        await repository.getContributorBySubmissionUploadId('00000000-0000-0000-0000-000000000001');
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect((err as ApiNotFoundError).message).to.equal('Contributor not found for submission upload');
      }
    });

    it('throws ApiExecuteSQLError when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          { contributor_id: 1, client_id: 'a' },
          { contributor_id: 2, client_id: 'b' }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      try {
        await repository.getContributorBySubmissionUploadId('00000000-0000-0000-0000-000000000001');
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Unexpected row count');
      }
    });
  });

  describe('getContributorBySubmissionId', () => {
    it('returns contributor when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ contributor_id: 42, client_id: 'my-client-id' }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      const result = await repository.getContributorBySubmissionId(123);

      expect(result).to.eql({ contributor_id: 42, client_id: 'my-client-id' });
    });

    it('throws ApiNotFoundError when contributor not found for submission', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      try {
        await repository.getContributorBySubmissionId(123);
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect((err as ApiNotFoundError).message).to.equal('Contributor not found for submission');
      }
    });

    it('throws ApiExecuteSQLError when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          { contributor_id: 1, client_id: 'a' },
          { contributor_id: 2, client_id: 'b' }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      try {
        await repository.getContributorBySubmissionId(123);
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiExecuteSQLError).message).to.equal('Unexpected row count');
      }
    });
  });

  describe('contributorExists', () => {
    it('returns true when contributor exists', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ contributor_id: 42 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      const result = await repository.contributorExists('my-client-id');

      expect(result).to.be.true;
    });

    it('returns false when contributor does not exist', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      const result = await repository.contributorExists('non-existent-client-id');

      expect(result).to.be.false;
    });

    it('returns false when rowCount is undefined', async () => {
      const mockQueryResponse = {
        rows: [{ contributor_id: 42 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new ContributorRepository(mockDBConnection);

      const result = await repository.contributorExists('my-client-id');

      expect(result).to.be.false;
    });
  });
});
