import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import * as db from '../../database/db';
import { IngestionValidationError } from '../../errors/submission-errors';
import { SubmissionUpload } from '../../models/submission-upload';
import { SubmissionIngestionService } from '../../services/ingestion/submission-ingestion-service';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { UploadArchiveService } from '../../services/upload/upload-archive-service';
import { getMockDBConnection } from '../../__mocks__/db';
import * as publisher from '../publisher';
import {
  processSubmissionFeaturesFailedHandler,
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
    sinon.stub(db, 'getAPIUserDBConnection').callsFake(() => {
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
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUpload').resolves({
        ...defaultSubmissionUpload,
        status: 'uploaded'
      });
      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToIngesting').resolves();
      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToIngested').resolves();
      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToInvalid').resolves();
      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus').resolves();
      sinon.stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus').resolves();
      sinon
        .stub(UploadArchiveService.prototype, 'updateUploadArchivesByUploadId')
        .resolves([{ upload_archive_id: 'archive-1' }]);
    });

    it('transitions uploaded -> ingesting -> ingested and publishes index job', async () => {
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });
      const publishStub = sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const toIngestingStub = SubmissionUploadService.prototype
        .transitionSubmissionUploadToIngesting as sinon.SinonStub;
      const toIngestedStub = SubmissionUploadService.prototype.transitionSubmissionUploadToIngested as sinon.SinonStub;
      expect(toIngestingStub.calledWith('test-sub-upload-id')).to.be.true;
      expect(toIngestedStub.calledWith('test-sub-upload-id')).to.be.true;
      expect(publishStub.calledOnce).to.be.true;
    });

    it('leaves row ingested when enqueue returns error', async () => {
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });
      sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'error', message: 'pg-boss unavailable' });

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const toIngestedStub = SubmissionUploadService.prototype.transitionSubmissionUploadToIngested as sinon.SinonStub;
      const toFailedStub = SubmissionUploadService.prototype.transitionSubmissionUploadStatus as sinon.SinonStub;
      expect(toIngestedStub.calledWith('test-sub-upload-id')).to.be.true;
      expect(toFailedStub.calledWith('test-sub-upload-id', 'failed')).to.be.false;
    });

    it('marks upload invalid when ingestion returns deterministic validation errors', async () => {
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({
        valid: false,
        errors: [{ message: 'bad data' } as any]
      });

      const publishStub = sinon.stub(publisher, 'publishIndexSubmissionFeaturesJob');

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const toInvalidStub = SubmissionUploadService.prototype.transitionSubmissionUploadToInvalid as sinon.SinonStub;
      expect(toInvalidStub.calledWith('test-sub-upload-id')).to.be.true;
      expect(publishStub.called).to.be.false;
    });

    it('persists completed validation metadata when ingestion has warning records', async () => {
      const warningRecords = [
        {
          level: 'warning',
          code: 'unknown_feature_type_ignored',
          message: 'Ignored 1 feature row(s) with unknown or inactive feature type',
          details: { count: 1, featureTypeCounts: { mystery: 1 } }
        }
      ];
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({
        valid: true,
        errors: [],
        records: warningRecords
      });
      sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const updateValidationStub = SubmissionValidationService.prototype.updateSubmissionValidationStatus as sinon.SinonStub;
      expect(updateValidationStub.calledWith('test-job-id', 'completed', { records: warningRecords })).to.be.true;
    });

    it('marks upload invalid and does not throw on shallow validation exceptions', async () => {
      sinon
        .stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload')
        .rejects(new IngestionValidationError('feature validation failed'));

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const toInvalidStub = SubmissionUploadService.prototype.transitionSubmissionUploadToInvalid as sinon.SinonStub;
      expect(toInvalidStub.calledWith('test-sub-upload-id')).to.be.true;
    });

    it('marks upload failed and rethrows on ingestion system exceptions', async () => {
      const testError = new Error('S3 unavailable');
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').rejects(testError);

      try {
        await processSubmissionFeaturesJobHandler([createMockJob()]);
        expect.fail('expected an error');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      const toFailedStub = SubmissionUploadService.prototype.transitionSubmissionUploadStatus as sinon.SinonStub;
      expect(
        toFailedStub.calledWith('test-sub-upload-id', 'failed', ['uploaded', 'ingesting', 'ingested', 'indexing'])
      ).to.be.true;
    });

    it('skips processing when current status is terminal', async () => {
      (SubmissionUploadService.prototype.getSubmissionUpload as sinon.SinonStub).resolves({
        ...defaultSubmissionUpload,
        status: 'indexed'
      });

      const ingestStub = sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload');

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      expect(ingestStub.called).to.be.false;
    });

    it('skips processing when current status is failed terminal', async () => {
      (SubmissionUploadService.prototype.getSubmissionUpload as sinon.SinonStub).resolves({
        ...defaultSubmissionUpload,
        status: 'failed'
      });

      const ingestStub = sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload');

      await processSubmissionFeaturesJobHandler([createMockJob()]);

      const toIngestingStub = SubmissionUploadService.prototype
        .transitionSubmissionUploadToIngesting as sinon.SinonStub;
      expect(ingestStub.called).to.be.false;
      expect(toIngestingStub.called).to.be.false;
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
        updateUploadStub.calledWith('test-sub-upload-id', 'failed', ['uploaded', 'ingesting', 'ingested', 'indexing'])
      ).to.be.true;
    });
  });
});
