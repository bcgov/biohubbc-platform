import dayjs from 'dayjs';
import { ArtifactStatusEnum } from '../../models/artifact';
import { IFlattenedBlock } from '../../models/submission-feature';
import { IngestionRepository } from '../../repositories/ingestion/ingestion-repository';
import { extractAndUploadMedia, extractBlocksFromArchive, IUploadedMediaFile } from '../../utils/biohub-tar-parser';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { getLogger } from '../../utils/logger';
import { DBService } from '../db-service';
import { FeatureValidationService } from './feature-ingestion-service';
import { IValidationError, IValidationResult, ValidationErrorType } from './feature-ingestion-service.interface';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { SubmissionUploadService } from '../upload/submission-upload-service';
import { UploadArchiveService } from '../upload/upload-archive-service';

const defaultLog = getLogger('services/ingestion/submission-ingestion-service');

// Approximate per-row overhead for download size estimation: CSV delimiters, quoting,
// and amortized column headers. Used by computeDataByteSizeMap to pre-compute data_byte_size.
const CSV_ROW_OVERHEAD_BYTES = 500;

/**
 * Service for processing submission archives via two-pass architecture.
 * Pass 1: Validate (zero side effects). Pass 2: Ingest (DB + S3).
 *
 * @export
 * @class SubmissionIngestionService
 * @extends {DBService}
 */
export class SubmissionIngestionService extends DBService {
  featureValidationService = new FeatureValidationService(this.connection);
  ingestionRepository = new IngestionRepository(this.connection);
  submissionUploadService = new SubmissionUploadService(this.connection);
  uploadArchiveService = new UploadArchiveService(this.connection);
  artifactService = new ArtifactService(this.connection);
  objectStorageService = new ObjectStorageService();

  /**
   * Process a submission archive using two-pass architecture.
   * Pass 1 validates features and media references (zero side effects).
   * Pass 2 uploads media to S3, creates artifact records, and ingests features.
   *
   * Idempotent: safe for pg-boss retries. Existing features are soft-deleted before
   * re-insertion, artifact inserts use ON CONFLICT DO NOTHING, and S3 PUTs overwrite.
   *
   * @param {number} submissionId - The submission to process
   * @returns {Promise<IValidationResult>} Validation result
   * @memberof SubmissionIngestionService
   */
  async processSubmission(submissionId: number): Promise<IValidationResult> {
    const objectKey = await this.getTarballObjectKey(submissionId);

    // ================================================================
    // PASS 1: VALIDATE (zero side effects)
    // ================================================================

    const tarStream1 = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);
    const { allBlocks, mediaFileNames } = await extractBlocksFromArchive(tarStream1);

    const featureValidation = await this.featureValidationService.validateFlatSubmissionFeatures(allBlocks);
    if (!featureValidation.valid) {
      return featureValidation;
    }

    const mediaErrors = validateMediaReferences(allBlocks, mediaFileNames);
    if (mediaErrors.length > 0) {
      return { valid: false, errors: mediaErrors };
    }

    // ================================================================
    // PASS 2: INGEST (DB writes + S3 uploads)
    // ================================================================

    const tarStream2 = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);
    const s3KeyPrefix = `submissions/${submissionId}/media`;
    const uploadedMediaFiles = await extractAndUploadMedia(tarStream2, this.objectStorageService, s3KeyPrefix);

    this.setArtifactKeys(allBlocks, uploadedMediaFiles);
    const dataByteSizeMap = this.computeDataByteSizeMap(allBlocks, uploadedMediaFiles);

    for (const [, mediaFile] of uploadedMediaFiles) {
      await this.artifactService.insertArtifact({
        bucket: getObjectStoreBucketName(),
        object_key: mediaFile.s3Key,
        byte_size: mediaFile.byteSize,
        artifact_status: ArtifactStatusEnum.UPLOADED,
        checksum_sha256: null,
        uploaded_at: dayjs().toISOString()
      });
    }

    // Delete existing features (idempotency for job retries), then insert
    await this.ingestionRepository.deleteSubmissionFeatures(submissionId);
    await this.insertFlatFeatures(submissionId, allBlocks, dataByteSizeMap);

    return { valid: true, errors: [] };
  }

  /**
   * Insert flat features using two-pass approach.
   * Pass 1: Insert all features with parent = NULL
   * Pass 2: Update parent references using UUID → ID mapping
   *
   * @private
   * @param {number} submissionId - The submission ID
   * @param {IFlattenedBlock[]} features - Features to insert
   * @param {Map<string, number>} dataByteSizeMap - Pre-computed byte sizes per feature UUID
   * @memberof SubmissionIngestionService
   */
  private async insertFlatFeatures(
    submissionId: number,
    features: IFlattenedBlock[],
    dataByteSizeMap: Map<string, number>
  ): Promise<void> {
    const uuidToDbId = new Map<string, number>();

    // Pass 1: Insert all features without parent references
    for (const feature of features) {
      const result = await this.ingestionRepository.insertSubmissionFeatureRecord(
        submissionId,
        null, // parent set in pass 2
        feature.id,
        feature.type,
        feature.properties,
        dataByteSizeMap.get(feature.id) ?? 0
      );
      uuidToDbId.set(feature.id, result.submission_feature_id);
    }

    // Pass 2: Update parent references
    for (const feature of features) {
      if (feature.parent) {
        const parentDbId = uuidToDbId.get(feature.parent);
        const featureDbId = uuidToDbId.get(feature.id);
        if (parentDbId && featureDbId) {
          await this.ingestionRepository.updateSubmissionFeatureParent(featureDbId, parentDbId);
        }
      }
    }
  }

  /**
   * Look up the S3 object key for a submission's tarball.
   * Traverses: submission → submission_upload → upload_archive → artifact → object_key
   *
   * @private
   * @param {number} submissionId - The submission ID
   * @returns {Promise<string>} The S3 object key
   * @memberof SubmissionIngestionService
   */
  private async getTarballObjectKey(submissionId: number): Promise<string> {
    const submissionUploads = await this.submissionUploadService.getSubmissionUploadsBySubmissionId(submissionId);
    if (submissionUploads.length === 0) {
      throw new Error(`No uploads found for submission ${submissionId}`);
    }

    const uploadArchives = await this.uploadArchiveService.getUploadArchivesByUploadId(submissionUploads[0].upload_id);
    if (uploadArchives.length === 0) {
      throw new Error(`No archives found for upload ${submissionUploads[0].upload_id}`);
    }

    const artifact = await this.artifactService.getArtifact(uploadArchives[0].artifact_id);
    return artifact.object_key;
  }

  /**
   * Set artifact_key on file/report blocks from uploaded media S3 keys.
   * Mutates blocks in place.
   *
   * @private
   * @param {IFlattenedBlock[]} blocks - All blocks (mutated in place)
   * @param {Map<string, IUploadedMediaFile>} uploadedMediaFiles - Uploaded media keyed by filename
   * @memberof SubmissionIngestionService
   */
  private setArtifactKeys(blocks: IFlattenedBlock[], uploadedMediaFiles: Map<string, IUploadedMediaFile>): void {
    for (const block of blocks) {
      if (block.type !== 'file' && block.type !== 'report') {
        continue;
      }

      const filename = block.properties['filename'] as string | undefined;
      if (!filename) {
        continue;
      }

      const mediaFile = uploadedMediaFiles.get(filename);
      if (!mediaFile) {
        defaultLog.warn({
          label: 'setArtifactKeys',
          message: `Expected media file '${filename}' not found in upload results`,
          blockId: block.id
        });
        continue;
      }

      block.properties['artifact_key'] = mediaFile.s3Key;
      delete block.properties['artifact_id'];
    }
  }

  /**
   * Compute data_byte_size per block: JSONB + overhead + artifact file size.
   *
   * @private
   * @param {IFlattenedBlock[]} blocks - All blocks
   * @param {Map<string, IUploadedMediaFile>} uploadedMediaFiles - Uploaded media keyed by filename
   * @returns {Map<string, number>} Byte size per block ID
   * @memberof SubmissionIngestionService
   */
  private computeDataByteSizeMap(
    blocks: IFlattenedBlock[],
    uploadedMediaFiles: Map<string, IUploadedMediaFile>
  ): Map<string, number> {
    const map = new Map<string, number>();

    for (const block of blocks) {
      const jsonBytes = Buffer.byteLength(JSON.stringify(block.properties));

      const filename = block.properties['filename'] as string | undefined;
      const mediaFile = filename ? uploadedMediaFiles.get(filename) : undefined;
      const artifactBytes = mediaFile?.byteSize ?? 0;

      map.set(block.id, jsonBytes + CSV_ROW_OVERHEAD_BYTES + artifactBytes);
    }

    return map;
  }
}

/**
 * Validate that every file/report block's filename has a matching media entry in the archive.
 *
 * @export
 * @param {IFlattenedBlock[]} blocks - All blocks from the archive
 * @param {Set<string>} mediaFileNames - Media filenames found in the archive
 * @returns {IValidationError[]} Validation errors for missing media references
 */
export function validateMediaReferences(blocks: IFlattenedBlock[], mediaFileNames: Set<string>): IValidationError[] {
  const errors: IValidationError[] = [];

  for (const block of blocks) {
    if (block.type !== 'file' && block.type !== 'report') {
      continue;
    }

    const filename = block.properties['filename'] as string | undefined;
    if (!filename) {
      continue;
    }

    if (!mediaFileNames.has(filename)) {
      errors.push({
        type: ValidationErrorType.MISSING_MEDIA_FILE,
        featureId: block.id,
        featureType: block.type,
        field: 'filename',
        value: filename,
        message: `Media file '${filename}' referenced by ${block.type} block '${block.id}' not found in archive`
      });
    }
  }

  return errors;
}
