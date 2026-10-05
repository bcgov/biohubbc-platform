import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getSubmissionUploadFeatureProperties } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../../database/db';
import { SubmissionFeaturePropertyService } from '../../../../../../../../../services/submission-feature-property-service';
import { SubmissionFeatureService } from '../../../../../../../../../services/submission-feature-service';

chai.use(sinonChai);

describe('getSubmissionUploadFeatureProperties', () => {
  afterEach(() => sinon.restore());

  it('validates upload ownership before returning feature properties', async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const validateFeature = sinon.stub(SubmissionFeatureService.prototype, 'getSubmissionUploadFeature').resolves();
    const getProperties = sinon
      .stub(SubmissionFeaturePropertyService.prototype, 'getSubmissionFeaturePropertiesBySubmissionUploadId')
      .resolves({ properties: [], total: 0 });
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '16',
      submissionUploadId: '11111111-1111-4111-8111-111111111111',
      submissionFeatureId: '12'
    };

    await getSubmissionUploadFeatureProperties()(mockReq, mockRes, () => {});

    expect(validateFeature).to.have.been.calledWith(16, mockReq.params.submissionUploadId, 12);
    expect(getProperties).to.have.been.calledWith(mockReq.params.submissionUploadId, 12);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.properties).to.eql([]);
    expect(mockRes.jsonValue.pagination.total).to.equal(0);
  });
});
