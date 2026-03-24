import { SubmissionUpload } from '../../models/submission-upload';
import { streamFeatures } from '../../utils/biohub-tar-parser';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArchiveService } from '../upload/upload-archive-service';
import { CodesetIngestionService } from './codeset-ingestion-service';
import { MediaIngestionService } from './media-ingestion-service';
import { SubmissionFeatureIngestionService } from './submission-feature-ingestion-service';
import { IValidationResult } from './submission-ingestion-service.interface';

const FEATURE_INSERT_BATCH_SIZE = 10000;

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

    // Resolve the S3 key for the uploaded tarball: upload_id → upload_archive → artifact → object_key
    const { objectKey, uploadArchiveId } = await this.getTarballUploadContext(uploadId);

    await this.featureIngestionService.deleteFeaturesBySubmissionUploadId(submissionUploadId);

    // Checkpointed streaming passes keep memory bounded while avoiding concurrent
    // full-archive scans against object storage for the same tarball.
    await this.mediaIngestionService.ingestMediaFiles(
      objectKey,
      submissionId,
      submissionUploadId,
      uploadId,
      uploadArchiveId
    );
    await this.codesetIngestionService.ingestCodesets(objectKey, submissionUploadId);
    await this.ingestFeatures(objectKey, submissionId, submissionUploadId);

    return { valid: true, errors: [] };
  }

  /**
   * Stream feature entries from the tarball and ingest them in batches.
   *
   * @private
   * @param {string} objectKey
   * @param {number} submissionId
   * @param {string} submissionUploadId
   * @returns {Promise<void>}
   */
  private async ingestFeatures(objectKey: string, submissionId: number, submissionUploadId: string): Promise<void> {
    const tarStream = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);

    await streamFeatures(tarStream, FEATURE_INSERT_BATCH_SIZE, async (featureBatch) => {
      await this.featureIngestionService.ingestFeatureBatch(submissionId, submissionUploadId, featureBatch);
    });
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
