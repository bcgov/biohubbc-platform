import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import { getOperationHandler } from '../../../../../../__mocks__/operation';
import * as db from '../../../../../../database/db';
import { authorizationDependencies } from '../../../../../../request-handlers/security/authorization';
import { SubmissionFeaturePropertyService } from '../../../../../../services/submission-feature-property-service';

chai.use(sinonChai);

describe('GET /api/submission/{submissionId}/feature/{submissionFeatureId}/properties', () => {
  afterEach(() => {
    sinon.restore();
  });

  it("authorizes the submission's team and a policy grant on the feature in that submission", async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7', submissionFeatureId: '20' };

    await getOperationHandler(index.GET, 0)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [
        { discriminator: 'Team', entity: 'submission', submissionId: 7 },
        { discriminator: 'SubmissionFeatureGrant', submissionId: 7, submissionFeatureId: 20 }
      ]
    });
    expect(index.GET.apiDoc?.security).to.eql([{ Bearer: [] }]);
  });

  it("returns a page of the feature's properties read through its submission", async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const propertiesStub = sinon
      .stub(SubmissionFeaturePropertyService.prototype, 'getSubmissionFeaturePropertiesBySubmissionId')
      .resolves({ properties: [], total: 0 });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '7', submissionFeatureId: '20' };
    mockReq.query = { page: '1', limit: '10' };

    await index.getSubmissionFeatureProperties()(mockReq, mockRes, mockNext);

    expect(propertiesStub).to.have.been.calledOnceWith(7, 20, sinon.match({ page: 1, limit: 10 }));
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.properties).to.eql([]);
  });
});
