import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { IArtifact } from '../../../../repositories/artifact-repository';
import { ArtifactService } from '../../../../services/artifact-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getArtifactsByDatasetId } from './attachments';

chai.use(sinonChai);

describe('getArtifactsByDatasetId', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return a valid array of artifact records on success', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const artifactServiceStub = sinon
      .stub(ArtifactService.prototype, 'getArtifactsByDatasetId')
      .resolves([{ artifact_id: 1 }, { artifact_id: 2 }] as IArtifact[]);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      datasetId: 'abcd'
    };

    const requestHandler = getArtifactsByDatasetId();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(artifactServiceStub).to.be.calledWith('abcd');
    expect(mockRes.jsonValue).to.eql({
      artifacts: [{ artifact_id: 1 }, { artifact_id: 2 }]
    });
  });

  it('catches and re-throws an error', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    sinon.stub(ArtifactService.prototype, 'getArtifactsByDatasetId').rejects(new Error('a test error'));

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      datasetId: 'abcd'
    };

    try {
      const requestHandler = getArtifactsByDatasetId();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('a test error');
    }
  });
});
