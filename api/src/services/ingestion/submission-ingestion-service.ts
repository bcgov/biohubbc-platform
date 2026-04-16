import { IngestionValidationError } from '../../errors/submission-errors';
import { SubmissionUpload } from '../../models/submission-upload';
import { streamSubmissionArchive } from '../../utils/biohub-tar-parser';
import { getLogger } from '../../utils/logger';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArchiveService } from '../upload/upload-archive-service';
import { CodesetIngestionService } from './codeset-ingestion-service';
import { MediaIngestionService } from './media-ingestion-service';
import { SubmissionFeatureIngestionService } from './submission-feature-ingestion-service';
import { IValidationResult } from './submission-ingestion-service.interface';

const FEATURE_INSERT_BATCH_SIZE = 10000;
const MEDIA_INGEST_BATCH_BYTES = Number(process.env.MEDIA_INGEST_BATCH_BYTES ?? 50 * 1024 * 1024);
const MEDIA_INGEST_BATCH_FILES = Number(process.env.MEDIA_INGEST_BATCH_FILES ?? 10000);
const MEDIA_INGEST_CONCURRENCY = Number(process.env.MEDIA_INGEST_CONCURRENCY ?? 4);
const defaultLog = getLogger('services/ingestion/submission-ingestion-service');

/**
 * Service for ingesting submission archives via streaming shallow-ingestion.
 *
 * @export
 * @class SubmissionIngestionService
 * @extends {DBService}
 */
export class SubmissionIngestionService extends DBService {
  featureIngestionService = new SubmissionFeatureIngestionService(this.connection);
  mediaIngestionService = new MediaIngestionService(this.connection);
  codesetIngestionService = new CodesetIngestionService(this.connection);
  uploadArchiveService = new UploadArchiveService(this.connection);
  artifactService = new ArtifactService(this.connection);
  objectStorageService = new ObjectStorageService();

  /**
   * Ingest a submission archive using streaming shallow-ingestion.
   * Deep validation and reference resolution are deferred to the indexing workflow.
   *
   * Idempotent: safe for pg-boss retries. Existing features for the current upload are
   * soft-deleted before re-insertion, artifact inserts use ON CONFLICT DO NOTHING, and S3 PUTs overwrite.
   *
   * Caller provides the pre-resolved submission_upload bridge record to avoid redundant
   * lookups — the job handler already resolves it for logging/indexing.
   * Tarball resolution requires upload_id (upload → upload_archive → artifact → S3 key),
   * while feature inserts use submission_upload_id (the processing identifier).
   *
   * @param {SubmissionUpload} submissionUpload - The pre-resolved bridge record.
   * @returns {Promise<IValidationResult>} Validation result
   * @memberof SubmissionIngestionService
   */
  async ingestSubmissionUpload(submissionUpload: SubmissionUpload): Promise<IValidationResult> {
    const {
      submission_upload_id: submissionUploadId,
      submission_id: submissionId,
      upload_id: uploadId
    } = submissionUpload;
    const startTime = Date.now();

    // Resolve the S3 key for the uploaded tarball: upload_id → upload_archive → artifact → object_key
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Resolving tarball upload context',
      submissionUploadId,
      submissionId,
      uploadId
    });
    const { objectKey, uploadArchiveId } = await this.getTarballUploadContext(uploadId);
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Resolved tarball upload context',
      submissionUploadId,
      uploadArchiveId,
      objectKey
    });

    await this.featureIngestionService.deleteFeaturesBySubmissionUploadId(submissionUploadId);
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Deleted existing features by submission upload id',
      submissionUploadId
    });

    // Keep all DB writes serialized on this connection while allowing the parser to stream
    // the archive once and route media/codes/features in one pass.
    let dbWriteChain: Promise<void> = Promise.resolve();
    const enqueueDbWrite = (writeTask: () => Promise<void>): Promise<void> => {
      const queuedWrite = dbWriteChain.then(writeTask);
      dbWriteChain = queuedWrite.then(
        () => undefined,
        () => undefined
      );
      return queuedWrite;
    };

    const streamStart = Date.now();
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Starting single-pass archive stream',
      submissionUploadId,
      objectKey,
      mediaBatchSize: MEDIA_INGEST_BATCH_FILES,
      mediaMaxBatchBytes: MEDIA_INGEST_BATCH_BYTES,
      mediaConcurrency: MEDIA_INGEST_CONCURRENCY,
      featureBatchSize: FEATURE_INSERT_BATCH_SIZE
    });

    const s3KeyPrefix = `submissions/${submissionId}/uploads/${submissionUploadId}/media`;
    const { uploadedCount, featureCount, codesetFileCount } = await streamSubmissionArchive(
      await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey),
      {
        objectStorageService: this.objectStorageService,
        s3KeyPrefix,
        mediaBatchSize: MEDIA_INGEST_BATCH_FILES,
        mediaMaxBatchBytes: MEDIA_INGEST_BATCH_BYTES,
        mediaConcurrency: MEDIA_INGEST_CONCURRENCY,
        featureBatchSize: FEATURE_INSERT_BATCH_SIZE,
        ingestMediaBatch: (uploadedFiles) =>
          enqueueDbWrite(() =>
            this.mediaIngestionService.persistUploadedMediaBatch(
              uploadId,
              uploadArchiveId,
              submissionUploadId,
              uploadedFiles
            )
          ),
        ingestCodesets: (codesets) =>
          enqueueDbWrite(() => this.codesetIngestionService.ingestParsedCodesets(submissionUploadId, codesets)),
        ingestFeatureBatch: (featureBatch) =>
          enqueueDbWrite(() =>
            this.featureIngestionService.ingestFeatureBatch(submissionId, submissionUploadId, featureBatch)
          )
      }
    );
    await dbWriteChain;

    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Completed single-pass archive stream',
      submissionUploadId,
      uploadedCount,
      featureCount,
      codesetFileCount,
      elapsedMs: Date.now() - streamStart
    });

    if (featureCount === 0) {
      throw new IngestionValidationError('No feature entries were found under features/ in the archive');
    }

    defaultLog.info({
      label: 'ingestSubmissionUpload',
      message: 'Submission upload ingestion completed',
      submissionUploadId,
      submissionId,
      uploadedCount,
      featureCount,
      codesetFileCount,
      elapsedMs: Date.now() - startTime
    });

    return { valid: true, errors: [] };
  }

  /**
   * Look up the S3 object key for a submission tarball.
   * Traverses: upload -> upload_archive -> artifact -> object_key.
   *
   * @private
   * @param {string} uploadId - The upload ID
   * @returns {Promise<{ objectKey: string; uploadArchiveId: string }>}
   * @memberof SubmissionIngestionService
   */
  private async getTarballUploadContext(uploadId: string): Promise<{ objectKey: string; uploadArchiveId: string }> {
    const uploadArchives = await this.uploadArchiveService.getUploadArchivesByUploadId(uploadId);
    if (uploadArchives.length === 0) {
      throw new Error(`No archives found for upload ${uploadId}`);
    }

    const artifact = await this.artifactService.getArtifact(uploadArchives[0].artifact_id);
    return {
      objectKey: artifact.object_key,
      uploadArchiveId: uploadArchives[0].upload_archive_id
    };
  }
}
