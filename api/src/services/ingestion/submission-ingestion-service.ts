import {
  UPLOAD_ARCHIVE_MEDIA_CONCURRENCY,
  UPLOAD_FEATURE_BATCH_MAX_BYTES,
  UPLOAD_FEATURE_BATCH_SIZE
} from '../../constants/upload';
import { IDBConnection } from '../../database/db';
import { IngestionValidationError } from '../../errors/submission-errors';
import { SubmissionUpload } from '../../models/submission-upload';
import { withConnection } from '../../queue/with-connection';
import { streamSubmissionArchive } from '../../utils/biohub-tar-parser';
import { getLogger } from '../../utils/logger';
import { ContributorService } from '../contributor-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArchiveService } from '../upload/upload-archive-service';
import { UploadArtifactService } from '../upload/upload-artifact-service';
import { CodesetIngestionService } from './codeset-ingestion-service';
import { MEDIA_INGEST_BATCH_BYTES, MEDIA_INGEST_BATCH_FILES, MediaIngestionService } from './media-ingestion-service';
import { SubmissionFeatureIngestionService } from './submission-feature-ingestion-service';
import { IValidationResult } from './submission-ingestion-service.interface';

const defaultLog = getLogger('services/ingestion/submission-ingestion-service');

export interface SubmissionIngestionDependencies {
  streamSubmissionArchive: typeof streamSubmissionArchive;
}

export const submissionIngestionDependencies: SubmissionIngestionDependencies = {
  streamSubmissionArchive
};

/**
 * Service for ingesting submission archives via streaming shallow-ingestion.
 *
 * @export
 * @class SubmissionIngestionService
 */
export class SubmissionIngestionService {
  objectStorageService = new ObjectStorageService();

  /**
   * Ingest a submission archive using streaming shallow-ingestion.
   * Deep validation and reference resolution are deferred to the indexing workflow.
   *
   * Idempotent: safe for pg-boss retries. Existing features for the current upload are
   * soft-deleted before re-insertion, archive-derived upload_artifact rows are deleted
   * before rebuilding, artifact inserts upsert by key, and S3 PUTs overwrite by object key.
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
    let featureBatchCount = 0;
    let codesetBatchCount = 0;
    let mediaBatchCount = 0;
    let featureRowsPersisted = 0;
    let mediaFilesPersisted = 0;
    let mediaBytesPersisted = 0;

    // Resolve the S3 key for the uploaded tarball: upload_id → upload_archive → artifact → object_key
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Starting submission upload ingestion',
      submissionUploadId,
      submissionId,
      uploadId
    });
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Resolving tarball upload context',
      submissionUploadId,
      submissionId,
      uploadId
    });
    const { objectKey, uploadArchiveId } = await withConnection((connection) =>
      this.getTarballUploadContext(connection, uploadId)
    );
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Resolved tarball upload context',
      submissionUploadId,
      uploadArchiveId,
      objectKey
    });

    // Step 1: Remove previously-ingested feature rows for this submission upload attempt.
    // Retries can re-run after partial success; scoping by submission_upload_id ensures
    // we only reset rows produced by this upload attempt, not other uploads.
    await withConnection(async (connection) => {
      const featureIngestionService = new SubmissionFeatureIngestionService(connection);
      await featureIngestionService.deleteFeaturesBySubmissionUploadId(submissionUploadId);
    });
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Deleted existing features by submission upload id',
      submissionUploadId
    });

    // Step 2: Soft-delete active upload_artifact links for this upload.
    // Why delete upload_artifact rows here:
    // - `upload_artifact` has uniqueness constraints (upload_id+artifact_id and upload_id+path for archive rows).
    // - A retry may produce the same paths/artifacts, and pure-insert repository methods should not own conflict resolution.
    // - Marking rows inactive once up-front keeps repository inserts deterministic.
    // - Scope is all active rows for this upload so conflicts are fully avoided on retry.
    await withConnection(async (connection) => {
      const uploadArtifactService = new UploadArtifactService(connection);
      await uploadArtifactService.deleteUploadArtifactsByUploadId(uploadId);
    });
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Deleted existing archive-derived upload artifact rows by upload id',
      uploadId
    });

    // Step 3: Resolve contributor context used by codeset ingestion callbacks.
    const contributorId = await withConnection(async (connection) => {
      const contributorService = new ContributorService(connection);
      const contributor = await contributorService.getContributorBySubmissionUploadId(submissionUploadId);
      return contributor.contributor_id;
    });
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Resolved contributor context for codeset ingestion',
      submissionUploadId,
      contributorId
    });

    // Resolve feature-type id mapping once per ingestion run so feature batches do
    // not re-query the mapping for every callback invocation.
    const activeFeatureTypeMap = await withConnection(async (connection) => {
      const featureIngestionService = new SubmissionFeatureIngestionService(connection);
      return featureIngestionService.getActiveFeatureTypeMap();
    });

    // Step 4: Stream tarball once and fan out entry processing by folder:
    // - features/* -> feature ingestion service
    // - codes/*    -> codeset ingestion service
    // - files/*    -> media ingestion service
    // The parser handles batching/concurrency; callbacks persist scoped records.
    const tarStream = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);
    defaultLog.debug({
      label: 'ingestSubmissionUpload',
      message: 'Starting archive stream pass',
      submissionUploadId,
      submissionId,
      uploadId,
      uploadArchiveId,
      objectKey,
      featureBatchSize: UPLOAD_FEATURE_BATCH_SIZE,
      featureMaxBatchBytes: UPLOAD_FEATURE_BATCH_MAX_BYTES,
      mediaBatchSize: MEDIA_INGEST_BATCH_FILES,
      mediaMaxBatchBytes: MEDIA_INGEST_BATCH_BYTES,
      mediaConcurrency: UPLOAD_ARCHIVE_MEDIA_CONCURRENCY
    });

    const { featureCount, uploadedCount, codesetFileCount } =
      await submissionIngestionDependencies.streamSubmissionArchive(tarStream, {
        objectStorageService: this.objectStorageService,
        s3KeyPrefix: `submissions/${submissionId}/uploads/${submissionUploadId}/media`,
        featureBatchSize: UPLOAD_FEATURE_BATCH_SIZE,
        featureMaxBatchBytes: UPLOAD_FEATURE_BATCH_MAX_BYTES,
        mediaBatchSize: MEDIA_INGEST_BATCH_FILES,
        mediaMaxBatchBytes: MEDIA_INGEST_BATCH_BYTES,
        mediaConcurrency: UPLOAD_ARCHIVE_MEDIA_CONCURRENCY,
        ingestFeatureBatch: async (featureBatch) => {
          featureBatchCount += 1;
          featureRowsPersisted += featureBatch.length;

          await withConnection(async (connection) => {
            const featureIngestionService = new SubmissionFeatureIngestionService(connection);
            await featureIngestionService.ingestFeatureBatch(
              submissionId,
              submissionUploadId,
              featureBatch,
              activeFeatureTypeMap
            );
          });

          if (featureBatchCount === 1 || featureBatchCount % 25 === 0) {
            defaultLog.debug({
              label: 'ingestSubmissionUpload',
              message: 'Persisted feature batch',
              submissionUploadId,
              featureBatchCount,
              batchSize: featureBatch.length,
              featureRowsPersisted
            });
          }
        },
        ingestCodesets: async (codesets) => {
          codesetBatchCount += 1;

          await withConnection(async (connection) => {
            const codesetIngestionService = new CodesetIngestionService(connection);
            await codesetIngestionService.persistContributorCodesets(contributorId, codesets);
          });

          defaultLog.debug({
            label: 'ingestSubmissionUpload',
            message: 'Persisted codeset payload',
            submissionUploadId,
            contributorId,
            codesetBatchCount,
            codesetKeyCount: Object.keys(codesets).length
          });
        },
        ingestMediaBatch: async (mediaFiles) => {
          mediaBatchCount += 1;
          mediaFilesPersisted += mediaFiles.length;
          const batchBytes = mediaFiles.reduce((total, mediaFile) => total + mediaFile.byteSize, 0);
          mediaBytesPersisted += batchBytes;

          await withConnection(async (connection) => {
            const mediaIngestionService = new MediaIngestionService(connection);
            await mediaIngestionService.persistUploadedMediaBatch(
              uploadId,
              uploadArchiveId,
              submissionUploadId,
              mediaFiles
            );
          });

          if (mediaBatchCount === 1 || mediaBatchCount % 10 === 0) {
            defaultLog.debug({
              label: 'ingestSubmissionUpload',
              message: 'Persisted media batch',
              submissionUploadId,
              mediaBatchCount,
              batchSize: mediaFiles.length,
              batchBytes,
              mediaFilesPersisted,
              mediaBytesPersisted
            });
          }
        }
      });

    defaultLog.info({
      label: 'ingestSubmissionUpload',
      message: 'Archive stream pass completed with ingestion counts',
      submissionUploadId,
      submissionId,
      featureCount,
      uploadedCount,
      codesetFileCount,
      featureBatchCount,
      codesetBatchCount,
      mediaBatchCount,
      featureRowsPersisted,
      mediaFilesPersisted,
      mediaBytesPersisted
    });

    // Step 5: Guardrail validation for malformed/empty archives.
    // Archive must contain at least one feature payload to be considered ingestible.
    if (featureCount === 0) {
      throw new IngestionValidationError('No feature entries were found under features/ in the archive');
    }

    defaultLog.info({
      label: 'ingestSubmissionUpload',
      message: 'Submission upload ingestion completed successfully',
      submissionUploadId,
      submissionId,
      featureCount,
      uploadedCount,
      codesetFileCount,
      featureBatchCount,
      codesetBatchCount,
      mediaBatchCount,
      featureRowsPersisted,
      mediaFilesPersisted,
      mediaBytesPersisted,
      elapsedMs: Date.now() - startTime
    });
    return { valid: true, errors: [] };
  }

  /**
   * Look up the S3 object key for a submission tarball.
   * Traverses: upload -> upload_archive -> artifact -> object_key.
   *
   * @private
   * @param {IDBConnection} connection
   * @param {string} uploadId - The upload ID
   * @returns {Promise<{ objectKey: string; uploadArchiveId: string }>}
   * @memberof SubmissionIngestionService
   */
  private async getTarballUploadContext(
    connection: IDBConnection,
    uploadId: string
  ): Promise<{ objectKey: string; uploadArchiveId: string }> {
    const uploadArchiveService = new UploadArchiveService(connection);
    const artifactService = new ArtifactService(connection);
    const uploadArchives = await uploadArchiveService.getUploadArchivesByUploadId(uploadId);
    if (uploadArchives.length === 0) {
      throw new Error(`No archives found for upload ${uploadId}`);
    }

    const artifact = await artifactService.getArtifact(uploadArchives[0].artifact_id);
    return {
      objectKey: artifact.object_key,
      uploadArchiveId: uploadArchives[0].upload_archive_id
    };
  }
}
