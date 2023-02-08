import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ArtifactRepository } from './artifact-repository';

chai.use(sinonChai);

describe('ArtifactRepository', () => {
  describe('getNextArtifactIds', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('test', async () => {
      const mockQueryResponse = { rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        query: async () => {
          return mockQueryResponse;
        }
      });

      const artifactRepository = new ArtifactRepository(mockDBConnection);

      const response = await artifactRepository.getNextArtifactIds(1);

      expect(response).to.eql([{ submission_id: 1 }]);
    });
  });

  describe('insertArtifactRecord', () => {
    //
  });
});
