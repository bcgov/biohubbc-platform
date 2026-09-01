import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { IngestionValidationError } from '../../errors/submission-errors';
import { SubmissionUpload } from '../../models/submission-upload';
import { SubmissionFeatureIngestionService } from '../../services/ingestion/submission-feature-ingestion-service';
import { SubmissionIngestionService } from '../../services/ingestion/submission-ingestion-service';
import { IValidationError, ValidationErrorType } from '../../services/ingestion/submission-ingestion-service.interface';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { UploadArchiveService } from '../../services/upload/upload-archive-service';
import {
  processSubmissionFeaturesFailedHandler,
  processSubmissionFeaturesJobDependencies,
  processSubmissionFeaturesJobHandler
} from './process-submission-features-job';

describe('process-submission-features-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  const defaultSubmissionUpload: SubmissionUpload = {
    submission_upload_id: 'test-sub-upload-id',
    submission_id: 123,
    upload_id: 'test-upload-id',
    status: 'uploaded',
    ticket_id: '11111111-1111-1111-1111-111111111111'
  };

  const createMockJob = (data: Partial<SubmissionUpload> = {}, jobId = 'test-job-id') =>
    ({
      id: jobId,
      name: 'process-submission-features',
      data: { ...defaultSubmissionUpload, ...data }
    } as PgBoss.Job<SubmissionUpload>);

  const stubConnections = () => {
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').callsFake(() => {
      const conn = getMockDBConnection();
      conn.open = sinon.stub().resolves();
      conn.commit = sinon.stub().resolves();
      conn.rollback = sinon.stub().resolves();
      conn.release = sinon.stub();
      return conn;
    });
  };

  describe('processSubmissionFeaturesJobHandler', () => {
    beforeEach(() => {
      stubConnections();
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadWithLock').resolves({
        ...defaultSubmissionUpload,
        status: 'uploaded'
      });
      sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload').resolves({
        submission_upload_id: defaultSubmissionUpload.submission_upload_id
      });
      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToIngested').resolves();
      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToInvalid').resolves();
      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus').resolves();
      sinon.stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus').resolves();
      sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'deleteSubmissionFeaturesBySubmissionUploadId')
        .resolves();
      sinon
        .stub(UploadArchiveService.prototype, 'updateUploadArchivesByUploadId')
        .resolves([{ upload_archive_id: 'archive-1' }]);
    });

    it('transitions uploaded -> ingesting -> ingested and publishes index job', async () => {
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });
      const publishStub = sinon
        .stub(processSubmissionFeaturesJobDependencies, 'publishReconcileSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const updateUploadStub = SubmissionUploadService.prototype.updateSubmissionUpload as sinon.SinonStub;
      const toIngestedStub = SubmissionUploadService.prototype.transitionSubmissionUploadToIngested as sinon.SinonStub;
      expect(updateUploadStub.calledWith('test-sub-upload-id', { status: 'ingesting' })).to.be.true;
      expect(toIngestedStub.calledWith('test-sub-upload-id')).to.be.true;
      expect(publishStub.calledOnce).to.be.true;
      expect(toIngestedStub.calledBefore(publishStub)).to.be.true;
      expect(publishStub.firstCall.args[1]).to.eql({
        submissionUploadId: 'test-sub-upload-id'
      });
    });

    it('retries the process stage when transactional reconciliation enqueue fails', async () => {
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });
      sinon
        .stub(processSubmissionFeaturesJobDependencies, 'publishReconcileSubmissionFeaturesJob')
        .rejects(new Error('pg-boss unavailable'));

      try {
        await processSubmissionFeaturesJobHandler([createMockJob()]);
        expect.fail('Expected enqueue failure');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');
      }

      const toIngestedStub = SubmissionUploadService.prototype.transitionSubmissionUploadToIngested as sinon.SinonStub;
      const updateValidationStub = SubmissionValidationService.prototype
        .updateSubmissionValidationStatus as sinon.SinonStub;
      const deleteFeaturesStub = SubmissionFeatureIngestionService.prototype
        .deleteSubmissionFeaturesBySubmissionUploadId as sinon.SinonStub;
      expect(toIngestedStub.calledWith('test-sub-upload-id')).to.be.true;
      expect(updateValidationStub.calledWith('test-job-id', 'completed')).to.be.true;
      expect(deleteFeaturesStub.calledOnceWith('test-sub-upload-id')).to.be.true;
    });

    it('marks upload invalid when ingestion returns deterministic validation errors', async () => {
      const validationError: IValidationError = {
        type: ValidationErrorType.INVALID_PROPERTY_TYPE,
        message: 'bad data'
      };

      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({
        valid: false,
        errors: [validationError]
      });

      const publishStub = sinon.stub(processSubmissionFeaturesJobDependencies, 'publishReconcileSubmissionFeaturesJob');

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const toInvalidStub = SubmissionUploadService.prototype.transitionSubmissionUploadToInvalid as sinon.SinonStub;
      expect(toInvalidStub.calledWith('test-sub-upload-id')).to.be.true;
      expect(publishStub.called).to.be.false;
    });

    it('marks upload invalid and does not throw on shallow validation exceptions', async () => {
      sinon
        .stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload')
        .rejects(new IngestionValidationError('feature validation failed'));

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const toInvalidStub = SubmissionUploadService.prototype.transitionSubmissionUploadToInvalid as sinon.SinonStub;
      expect(toInvalidStub.calledWith('test-sub-upload-id')).to.be.true;
    });

    it('rethrows on ingestion system exceptions without prematurely marking upload failed', async () => {
      const testError = new Error('S3 unavailable');
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').rejects(testError);

      try {
        await processSubmissionFeaturesJobHandler([createMockJob()]);
        expect.fail('expected an error');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      const toFailedStub = SubmissionUploadService.prototype.transitionSubmissionUploadStatus as sinon.SinonStub;
      const deleteFeaturesStub = SubmissionFeatureIngestionService.prototype
        .deleteSubmissionFeaturesBySubmissionUploadId as sinon.SinonStub;
      expect(toFailedStub.called).to.be.false;
      expect(deleteFeaturesStub.calledWith('test-sub-upload-id')).to.be.true;
    });

    it('rethrows original processing error when cleanup fails', async () => {
      const testError = new Error('S3 unavailable');
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').rejects(testError);
      const deleteFeaturesStub = SubmissionFeatureIngestionService.prototype
        .deleteSubmissionFeaturesBySubmissionUploadId as sinon.SinonStub;
      deleteFeaturesStub.rejects(new Error('cleanup failed'));

      try {
        await processSubmissionFeaturesJobHandler([createMockJob()]);
        expect.fail('expected an error');
      } catch (error) {
        expect(error).to.equal(testError);
      }
    });

    it('skips processing when current status is terminal', async () => {
      (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves({
        ...defaultSubmissionUpload,
        status: 'indexed'
      });

      const ingestStub = sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload');

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      expect(ingestStub.called).to.be.false;
    });

    it('allows reprocessing when current status is ingesting', async () => {
      (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves({
        ...defaultSubmissionUpload,
        status: 'ingesting'
      });

      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });
      sinon
        .stub(processSubmissionFeaturesJobDependencies, 'publishReconcileSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const updateUploadStub = SubmissionUploadService.prototype.updateSubmissionUpload as sinon.SinonStub;
      expect(updateUploadStub.calledWith('test-sub-upload-id', { status: 'ingesting' })).to.be.true;
    });

    it('allows restart when current status is failed', async () => {
      (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves({
        ...defaultSubmissionUpload,
        status: 'failed'
      });

      const ingestStub = sinon
        .stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload')
        .resolves({ valid: true, errors: [] });
      sinon
        .stub(processSubmissionFeaturesJobDependencies, 'publishReconcileSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const updateUploadStub = SubmissionUploadService.prototype.updateSubmissionUpload as sinon.SinonStub;
      expect(updateUploadStub.calledWith('test-sub-upload-id', { status: 'ingesting' })).to.be.true;
      expect(ingestStub.calledOnce).to.be.true;
    });
  });

  describe('processSubmissionFeaturesFailedHandler', () => {
    it('updates submission upload and validation to failed', async () => {
      stubConnections();

      const updateUploadStub = sinon
        .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus')
        .resolves();
      const updateValidationStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatusBySubmissionUploadId')
        .resolves();

      const job = {
        id: 'dlq-job-id',
        data: defaultSubmissionUpload,
        output: { message: 'boom' }
      } as unknown as PgBoss.JobWithMetadata<SubmissionUpload>;

      await processSubmissionFeaturesFailedHandler([job]);

      expect(updateValidationStub.calledOnce).to.be.true;
      expect(
        updateUploadStub.calledWith('test-sub-upload-id', 'failed', [
          'uploaded',
          'ingesting',
          'ingested',
          'indexing',
          'failed'
        ])
      ).to.be.true;
    });
  });
});
