import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { SECURITY_APPLIED_STATUS } from '../../../repositories/security-repository';
import { SubmissionRecordWithSecurityAndRootFeatureType } from '../../../repositories/submission-repository';
import { SubmissionService } from '../../../services/submission-service';
import { getReviewedSubmissionsForAdmins } from './reviewed';

chai.use(sinonChai);

describe('getReviewedSubmissionsForAdmins', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('re-throws any error that is thrown', async () => {
    const mockDBConnection = getMockDBConnection({
      open: () => {
        throw new Error('test error');
      }
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const requestHandler = getReviewedSubmissionsForAdmins();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

  it('should return an array of Reviewed submission objects', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const mockResponse: SubmissionRecordWithSecurityAndRootFeatureType[] = [
      {
        submission_id: 1,
        uuid: '123-456-789',
        submitted_timestamp: '2023-12-12',
        publish_timestamp: '2023-12-12',
        system_user_id: 3,
        contributor_id: 1,
        name: 'name',
        description: 'description',
        comment: 'comment',
        create_user: 1,
        update_user: null,
        security: SECURITY_APPLIED_STATUS.SECURED,
        root_feature_type_id: 1,
        root_feature_type_name: 'dataset',
        regions: []
      },
      {
        submission_id: 2,
        uuid: '789-456-123',
        submitted_timestamp: '2023-12-12',
        system_user_id: 3,
        contributor_id: 1,
        publish_timestamp: '2023-12-12',
        name: 'name',
        description: 'description',
        comment: 'comment',
        create_user: 1,
        update_user: 1,
        security: SECURITY_APPLIED_STATUS.PARTIALLY_SECURED,
        root_feature_type_id: 1,
        root_feature_type_name: 'dataset',
        regions: []
      }
    ];

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const getReviewedSubmissionsStub = sinon
      .stub(SubmissionService.prototype, 'getReviewedSubmissionsForAdmins')
      .resolves(mockResponse);

    const requestHandler = getReviewedSubmissionsForAdmins();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getReviewedSubmissionsStub).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResponse);
  });
});
