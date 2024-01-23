import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { SubmissionFeatureRecord } from '../../repositories/submission-repository';
import { SystemUser } from '../../repositories/user-repository';
import { ArtifactService } from '../../services/artifact-service';
import * as keycloakUtils from '../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import { intakeArtifact } from './intake';

chai.use(sinonChai);

describe('intakeArtifact', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should throw a 400 error when no file included in request', async () => {
    const dbConnectionObj = getMockDBConnection();

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      submission_uuid: '123-456-789',
      artifact_upload_key: '456-234-345',
      media: ''
    };

    // Too few files
    mockReq.files = [];

    try {
      const requestHandler = intakeArtifact();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(400);
      expect((actualError as HTTPError).message).to.equal('Missing required `media`');
    }
  });

  it('should throw a 400 error when more than 1 file uploaded', async () => {
    const dbConnectionObj = getMockDBConnection();

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      submission_uuid: '123-456-789',
      artifact_upload_key: '456-234-345',
      media: ''
    };

    // Too many files
    mockReq.files = [
      {
        fieldname: 'media',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 340
      },
      {
        fieldname: 'media',
        originalname: 'test2.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 50
      }
    ] as Express.Multer.File[];

    try {
      const requestHandler = intakeArtifact();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(400);
      expect((actualError as HTTPError).message).to.equal('Too many files uploaded, expected 1');
    }
  });

  it('catches and re-throws an error if artifact processing fails', async () => {
    const dbConnectionObj = getMockDBConnection();

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const submissionUuid = '123-456-789';
    const artifactUploadKey = '456-234-345';
    const artifactFile = {
      fieldname: 'media',
      originalname: 'test.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      size: 340
    } as Express.Multer.File;

    mockReq.body = {
      submission_uuid: submissionUuid,
      artifact_upload_key: artifactUploadKey,
      media: ''
    };

    mockReq.files = [artifactFile] as Express.Multer.File[];

    // Fail to process artifact
    const uploadSubmissionFeatureArtifactStub = sinon
      .stub(ArtifactService.prototype, 'uploadSubmissionFeatureArtifact')
      .throws(new Error('test error'));

    const requestHandler = intakeArtifact();

    try {
      await requestHandler(mockReq, mockRes, mockNext);

      expect.fail();
    } catch (actualError) {
      expect(uploadSubmissionFeatureArtifactStub).to.have.been.calledOnceWith(artifactUploadKey, artifactFile);
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 on success', async () => {
    const dbConnectionObj = getMockDBConnection();

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const submissionUuid = '123-456-789';
    const artifactUploadKey = '456-234-345';
    const artifactFile = {
      fieldname: 'media',
      originalname: 'test.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      size: 340
    } as Express.Multer.File;

    mockReq.body = {
      submission_uuid: submissionUuid,
      artifact_upload_key: artifactUploadKey,
      media: ''
    };

    mockReq.files = [artifactFile] as Express.Multer.File[];

    const uploadArtifactResponse: SubmissionFeatureRecord = {
      submission_feature_id: 1,
      uuid: '456-234-345',
      submission_id: 2,
      feature_type_id: 3,
      source_id: 'source-id',
      data: {
        filename: 'test.txt'
      },
      parent_submission_feature_id: 4,
      record_effective_date: '2020-01-01',
      record_end_date: null,
      create_date: '2020-01-01',
      create_user: 1,
      update_date: null,
      update_user: null,
      revision_count: 0
    };

    const uploadSubmissionFeatureArtifactStub = sinon
      .stub(ArtifactService.prototype, 'uploadSubmissionFeatureArtifact')
      .resolves(uploadArtifactResponse);

    const requestHandler = intakeArtifact();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(uploadSubmissionFeatureArtifactStub).to.have.been.calledOnceWith(artifactUploadKey, artifactFile);

    expect(mockRes.status).to.have.been.calledWith(200);
    expect(mockRes.json).to.have.been.calledWith({ artifact_uuid: uploadArtifactResponse.uuid });
  });
});
