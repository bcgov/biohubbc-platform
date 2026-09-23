import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../../../../../../constants/roles';
import * as db from '../../../../../../../../../database/db';
import { authorizationDependencies } from '../../../../../../../../../request-handlers/security/authorization';
import { SubmissionFeaturePropertyGeometryService } from '../../../../../../../../../services/submission-feature-property-geometry-service';

describe('getSubmissionUploadFeatureGeometryExtent', () => {
  afterEach(() => sinon.restore());

  it('returns the scoped extent without tile credentials', async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const extent = { bbox: [-125, 48, -120, 52] as [number, number, number, number], geometry_count: 2 };
    const query = sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getSubmissionUploadFeatureGeometryExtent')
      .resolves(extent);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '12', submissionUploadId: 'upload-1', submissionFeatureId: '34' };
    await index.getSubmissionUploadFeatureGeometryExtent()(mockReq, mockRes, mockNext);
    expect(query.calledOnceWithExactly(12, 'upload-1', 34)).to.equal(true);
    expect(mockRes.jsonValue).to.eql(extent);
  });

  it('requires a system administrator', async () => {
    const authorize = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    await (index.GET as unknown as RequestHandler[])[0](mockReq, mockRes, mockNext);
    expect(mockReq.authorization_scheme).to.eql({
      and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
    });
    expect(authorize.calledOnce).to.equal(true);
  });
});
