import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { SECURITY_APPLIED_STATUS } from '../../../repositories/security-repository';
import { SubmissionRecordWithSecurityAndRootFeatureType } from '../../../repositories/submission-repository';
import { SubmissionService } from '../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { getUnreviewedSubmissionsForAdmins } from './unreviewed';

chai.use(sinonChai);

describe('getUnreviewedSubmissionsForAdmins', () => {
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

    const requestHandler = getUnreviewedSubmissionsForAdmins();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

  it('should return an array of unreviewed submission objects', async () => {
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
        security_review_timestamp: null,
        submitted_timestamp: '2023-12-12',
        publish_timestamp: '2023-12-12',
        source_system: 'SIMS',
        name: 'name',
        description: 'description',
        create_date: '2023-12-12',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 0,
        security: SECURITY_APPLIED_STATUS.PENDING,
        root_feature_type_id: 1,
        root_feature_type_name: 'dataset'
      },
      {
        submission_id: 2,
        uuid: '789-456-123',
        security_review_timestamp: null,
        submitted_timestamp: '2023-12-12',
        publish_timestamp: '2023-12-12',
        source_system: 'SIMS',
        name: 'name',
        description: 'description',
        create_date: '2023-12-12',
        create_user: 1,
        update_date: '2023-12-12',
        update_user: 1,
        revision_count: 1,
        security: SECURITY_APPLIED_STATUS.PENDING,
        root_feature_type_id: 1,
        root_feature_type_name: 'dataset'
      }
    ];

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const getUnreviewedSubmissionsStub = sinon
      .stub(SubmissionService.prototype, 'getUnreviewedSubmissionsForAdmins')
      .resolves(mockResponse);

    const requestHandler = getUnreviewedSubmissionsForAdmins();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getUnreviewedSubmissionsStub).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResponse);
  });
});
