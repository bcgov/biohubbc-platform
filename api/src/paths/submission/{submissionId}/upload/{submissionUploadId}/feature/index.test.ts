import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import { getOperationHandler } from '../../../../../../__mocks__/operation';
import * as db from '../../../../../../database/db';
import { authorizationDependencies } from '../../../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../../../services/submission-service';

chai.use(sinonChai);

describe('GET /api/submission/{submissionId}/upload/{submissionUploadId}/feature', () => {
  afterEach(() => {
    sinon.restore();
  });

  it("authorizes only the submission's team", async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7', submissionUploadId: 'upload-id' };

    await getOperationHandler(index.GET, 0)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [{ discriminator: 'Team', entity: 'submission', submissionId: 7 }]
    });
    expect(index.GET.apiDoc?.security).to.eql([{ Bearer: [] }]);
  });

  it("returns a page of the upload's features for the authenticated user", async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection({ systemUserId: () => 1000 }));
    const page = {
      features: [{ submission_id: 7, submission_feature_id: 20, feature_type_name: 'observation', feature_type_id: 3 }],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10, sort: undefined, order: undefined }
    };
    const pageStub = sinon.stub(SubmissionService.prototype, 'getSubmissionUploadFeaturePage').resolves(page);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '7', submissionUploadId: 'upload-id' };
    mockReq.query = { page: '1', limit: '10' };

    await index.getSubmissionUploadFeatures()(mockReq, mockRes, mockNext);

    expect(pageStub).to.have.been.calledOnceWith(7, 'upload-id', 1000, sinon.match({ page: 1, limit: 10 }));
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(page);
  });
});
