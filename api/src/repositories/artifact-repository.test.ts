import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { ArtifactRepository, IArtifact } from './artifact-repository';

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

    const mockArtifact: IArtifact = {
      artifact_id: 1,
      submission_id: 2,
      uuid: 'abcd',
      input_key: 'test-key',
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

      const submissionRepository = new ArtifactRepository(mockDBConnection);

      try {
        await submissionRepository.insertArtifactRecord(mockArtifact);
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

      const submissionRepository = new ArtifactRepository(mockDBConnection);

      const response = await submissionRepository.insertArtifactRecord(mockArtifact);

      expect(response.artifact_id).to.equal(1);
    });
  });
});
