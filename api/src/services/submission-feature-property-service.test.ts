import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { FeaturePropertyRepository } from '../repositories/feature-property-repository';
import { SubmissionFeaturePropertyService } from './submission-feature-property-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

describe('SubmissionFeaturePropertyService upload feature-type definitions', () => {
  afterEach(() => sinon.restore());

  it('reads definitions only after confirming upload ownership', async () => {
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUpload').resolves({ submission_id: 16 } as any);
    const getProperties = sinon
      .stub(FeaturePropertyRepository.prototype, 'getSubmissionUploadFeatureTypeProperties')
      .resolves([]);
    const service = new SubmissionFeaturePropertyService(getMockDBConnection());
    expect(await service.getSubmissionUploadFeatureTypeProperties(16, 'upload-id', 'animal')).to.deep.equal([]);
    expect(getProperties.firstCall.args).to.deep.equal([16, 'upload-id', 'animal']);
  });

  it('rejects a foreign submission without reading its definitions', async () => {
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUpload').resolves({ submission_id: 17 } as any);
    const getProperties = sinon.stub(FeaturePropertyRepository.prototype, 'getSubmissionUploadFeatureTypeProperties');
    const service = new SubmissionFeaturePropertyService(getMockDBConnection());
    try {
      await service.getSubmissionUploadFeatureTypeProperties(16, 'upload-id', 'animal');
      expect.fail('Expected ownership rejection');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiNotFoundError);
    }
    expect(getProperties.called).to.equal(false);
  });
});
