import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getQuarantinedSubmissionsForAdmins } from '.';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { SECURITY_APPLIED_STATUS } from '../../../../repositories/security-repository';
import { SubmissionRecordWithSecurityAndRootFeatureType } from '../../../../repositories/submission-repository';
import { SubmissionService } from '../../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

chai.use(sinonChai);

describe('getQuarantinedSubmissionsForAdmins', () => {
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

    const requestHandler = getQuarantinedSubmissionsForAdmins();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

  it('should return an array of quarantined submission objects', async () => {
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
        system_user_id: 3,
        source_system: 'SIMS',
        name: 'name',
        description: 'description',
        comment: 'comment',
        create_date: '2023-12-12',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 0,
        security: SECURITY_APPLIED_STATUS.PENDING,
        root_feature_type_id: 1,
        root_feature_type_name: 'dataset',
        regions: []
      },
      {
        submission_id: 2,
        uuid: '789-456-123',
        security_review_timestamp: null,
        submitted_timestamp: '2023-12-12',
        publish_timestamp: '2023-12-12',
        system_user_id: 3,
        source_system: 'SIMS',
        name: 'name',
        description: 'description',
        comment: 'comment',
        create_date: '2023-12-12',
        create_user: 1,
        update_date: '2023-12-12',
        update_user: 1,
        revision_count: 1,
        security: SECURITY_APPLIED_STATUS.PENDING,
        root_feature_type_id: 1,
        root_feature_type_name: 'dataset',
        regions: []
      }
    ];

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const getQuarantinedSubmissionsStub = sinon
      .stub(SubmissionService.prototype, 'getQuarantinedSubmissionsForAdmins')
      .resolves(mockResponse);

    const requestHandler = getQuarantinedSubmissionsForAdmins();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getQuarantinedSubmissionsStub).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResponse);
  });
});
