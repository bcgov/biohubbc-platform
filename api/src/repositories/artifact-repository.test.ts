import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { Artifact, ArtifactRepository } from './artifact-repository';

chai.use(sinonChai);

describe('ArtifactRepository', () => {
  describe('getNextArtifactIds', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns an array of artifact_ids', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [{ artifact_id: 1 }, { artifact_id: 2 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      const response = await artifactRepository.getNextArtifactIds(2);

      expect(response).to.eql([1, 2]);
    });

    it('throw an error if query fails', async () => {
      const mockQueryResponse = { rows: undefined, rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      try {
        await artifactRepository.getNextArtifactIds(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get next artifact IDs');
      }
    });
  });

  describe('insertArtifactRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    const mockArtifact: Artifact = {
      artifact_id: 1,
      submission_id: 2,
      uuid: 'abcd',
      key: 'test-key',
      file_name: 'file-name',
      file_type: 'file-type',
      title: 'Title',
      description: 'Description',
      file_size: 1
    };

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      try {
        await artifactRepository.insertArtifactRecord(mockArtifact);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert artifact record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ artifact_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      const response = await artifactRepository.insertArtifactRecord(mockArtifact);

      expect(response.artifact_id).to.equal(1);
    });
  });

  describe('getArtifactsByDatasetId', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [{ artifact_id: 1 }, { artifact_id: 2 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      const response = await artifactRepository.getArtifactsByDatasetId('abcd');

      expect(response[0].artifact_id).to.equal(1);
      expect(response[1].artifact_id).to.equal(2);
    });
  });

  describe('getArtifactById', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ artifact_id: 1 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      const response = await artifactRepository.getArtifactById(1);

      expect(response).to.eql({ artifact_id: 1 });
    });

    it('throw an error if query fails', async () => {
      const mockQueryResponse = { rows: undefined, rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      try {
        await artifactRepository.getArtifactById(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to retrieve artifact record by ID');
      }
    });
  });

  describe('updateArtifactSecurityReviewTimestamp', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ artifact_id: 1 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new ArtifactRepository(mockDBConnection);

      const response = await submissionRepository.updateArtifactSecurityReviewTimestamp(1);

      expect(response).to.eql(undefined);
    });

    it('throw an error if query fails', async () => {
      const mockQueryResponse = { rows: undefined, rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      try {
        await artifactRepository.updateArtifactSecurityReviewTimestamp(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to update artifact security review timestamp'
        );
      }
    });
  });

  describe('getArtifactsByIds', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [{ artifact_id: 1 }, { artifact_id: 2 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockQueryResponse
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      const response = await artifactRepository.getArtifactsByIds([1, 2]);

      expect(response).to.eql([{ artifact_id: 1 }, { artifact_id: 2 }]);
    });

    it('should succeed with empty array as response', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockQueryResponse
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      const response = await artifactRepository.getArtifactsByIds([1, 2]);

      expect(response).to.eql([]);
    });
  });

  describe('getArtifactByUUID', () => {
    it('should return with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ artifact_id: 1 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });
      const artifactRepository = new ArtifactRepository(mockDBConnection);
      const response = await artifactRepository.getArtifactByUUID('uuid');

      expect(response).to.eql({ artifact_id: 1 });
    });

    it('should return null', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });
      const artifactRepository = new ArtifactRepository(mockDBConnection);
      const response = await artifactRepository.getArtifactByUUID('uuid');

      expect(response).to.eql(null);
    });
  });
});
