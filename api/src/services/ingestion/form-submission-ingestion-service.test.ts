import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { IngestionValidationError } from '../../errors/submission-errors';
import { IFlattenedBlock } from '../../models/submission-feature';
import { SubmissionUpload } from '../../models/submission-upload';
import { FormSubmissionIngestionService } from './form-submission-ingestion-service';
import { SubmissionFeatureIngestionService } from './submission-feature-ingestion-service';

describe('FormSubmissionIngestionService', () => {
  const submissionUpload = {
    submission_upload_id: 'sub-upload-1',
    submission_id: 8,
    upload_id: 'upload-1',
    status: 'ingesting'
  } as SubmissionUpload;

  beforeEach(() => {
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').callsFake(() => getMockDBConnection());
  });

  afterEach(() => {
    sinon.restore();
  });

  it('replaces staged features and persists the stored features', async () => {
    const deleteStub = sinon
      .stub(SubmissionFeatureIngestionService.prototype, 'deleteSubmissionFeaturesBySubmissionUploadId')
      .resolves();
    const knownFeatureTypeMap = new Map([['observation', 100]]);
    sinon.stub(SubmissionFeatureIngestionService.prototype, 'getKnownFeatureTypeMap').resolves(knownFeatureTypeMap);
    const ingestStub = sinon.stub(SubmissionFeatureIngestionService.prototype, 'ingestFeatureBatch').resolves();
    const features: IFlattenedBlock[] = [
      { id: 'row-1', type: 'observation', properties: { count: 1 }, content: [], parent: null }
    ];

    const result = await new FormSubmissionIngestionService().ingestFormSubmissionUpload(submissionUpload, features);

    expect(deleteStub.calledOnceWith('sub-upload-1')).to.be.true;
    expect(deleteStub.calledBefore(ingestStub)).to.be.true;
    expect(ingestStub.calledOnceWith(8, 'sub-upload-1', features, knownFeatureTypeMap)).to.be.true;
    expect(result.valid).to.be.true;
    expect(result.metadata?.featureCount).to.equal(1);
  });

  it('fails validation when the upload has no features', async () => {
    try {
      await new FormSubmissionIngestionService().ingestFormSubmissionUpload(submissionUpload, []);
      expect.fail();
    } catch (error) {
      expect(error).to.be.instanceof(IngestionValidationError);
    }
  });
});
