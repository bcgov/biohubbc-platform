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

    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

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

    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

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
        security: SECURITY_APPLIED_STATUS.PENDING,
        root_feature_type_id: 1,
        root_feature_type_name: 'survey',
        regions: []
      },
      {
        submission_id: 2,
        uuid: '789-456-123',
        submitted_timestamp: '2023-12-12',
        publish_timestamp: '2023-12-12',
        system_user_id: 3,
        contributor_id: 1,
        name: 'name',
        description: 'description',
        comment: 'comment',
        create_user: 1,
        update_user: 1,
        security: SECURITY_APPLIED_STATUS.PENDING,
        root_feature_type_id: 1,
        root_feature_type_name: 'survey',
        regions: []
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
