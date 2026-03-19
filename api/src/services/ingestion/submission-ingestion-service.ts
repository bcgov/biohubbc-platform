import dayjs from 'dayjs';
import SQL from 'sql-template-strings';
import { ArtifactStatusEnum } from '../../models/artifact';
import { IFlattenedBlock } from '../../models/submission-feature';
import { SubmissionUpload } from '../../models/submission-upload';
import { UploadArtifactRoleEnum } from '../../models/upload-artifact';
import { IngestionRepository } from '../../repositories/ingestion/ingestion-repository';
import {
  extractAndUploadCodesets,
  extractAndUploadMedia,
  extractBlocksFromArchive,
  IUploadedMediaFile
} from '../../utils/biohub-tar-parser';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { getLogger } from '../../utils/logger';
import { ContributorService } from '../contributor-service';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { SubmissionFeaturePropertyIndexService } from '../submission-feature-property-index-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArchiveService } from '../upload/upload-archive-service';
import { FeatureValidationService } from './feature-validation-service';
import { IValidationError, IValidationResult, ValidationErrorType } from './feature-validation-service.interface';
import { SubmissionIngestionCodesService } from './submission-ingestion-codes-service';

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
  uploadArchiveService = new UploadArchiveService(this.connection);
  artifactService = new ArtifactService(this.connection);
  submissionFeaturePropertyIndexService = new SubmissionFeaturePropertyIndexService(this.connection);
  contributorService = new ContributorService(this.connection);
  objectStorageService = new ObjectStorageService();
  submissionIngestionCodesService = new SubmissionIngestionCodesService();

  /**
   * Process a submission archive using two-pass architecture.
   * Pass 1 validates features and media references (zero side effects).
   * Pass 2 uploads media to S3, creates artifact records, and ingests features.
   *
   * Idempotent: safe for pg-boss retries. Existing features are soft-deleted before
   * re-insertion, artifact inserts use ON CONFLICT DO NOTHING, and S3 PUTs overwrite.
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
  async processSubmission(submissionUpload: SubmissionUpload): Promise<IValidationResult> {
    const {
      submission_upload_id: submissionUploadId,
      submission_id: submissionId,
      upload_id: uploadId
    } = submissionUpload;

    // Resolve the S3 key for the uploaded tarball: upload_id → upload_archive → artifact → object_key
    const { objectKey, uploadArchiveId } = await this.getTarballUploadContext(uploadId);

    // ================================================================
    // PASS 1: VALIDATE (zero side effects)
    // Two-pass architecture: validate everything before writing anything,
    // so a validation failure never leaves partial data behind.
    // ================================================================

    // Stream 1: parse the tarball into flat feature blocks and a set of media filenames
    const tarStream1 = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);
    const { allBlocks, mediaFileNames, codesets } = await extractBlocksFromArchive(tarStream1);

    // Validate feature structure: types exist in feature_type, required properties present, types correct
    const featureValidation = await this.featureValidationService.validateFlatSubmissionFeatures(allBlocks, codesets);
    if (!featureValidation.valid) {
      return featureValidation;
    }

    // Validate media integrity: every file/report block's filename must have a matching file in the archive
    const mediaErrors = validateMediaReferences(allBlocks, mediaFileNames);
    if (mediaErrors.length > 0) {
      return { valid: false, errors: mediaErrors };
    }

    // Persist contributor codeset/category + code definitions before downstream indexing.
    // This ensures index jobs can resolve code slugs entirely from database state.
    const referencedCodeReferences = this.submissionIngestionCodesService.getUniqueCodeReferencesFromBlocks(allBlocks);
    const contributor = await this.contributorService.getContributorBySubmissionUploadId(submissionUploadId);
    await this.submissionFeaturePropertyIndexService.persistContributorCodesByContributorId(
      contributor.contributor_id,
      codesets,
      referencedCodeReferences
    );

    // ================================================================
    // PASS 2: INGEST (DB writes + S3 uploads)
    // All validation passed — safe to write. From here, operations are
    // idempotent: S3 PUTs overwrite, artifact inserts use ON CONFLICT DO
    // NOTHING, and features are soft-deleted before re-insertion.
    // ================================================================

    // Stream 2: re-stream the tarball to extract and upload media files to S3
    // (tar streams are single-pass, so we need a fresh stream)
    const tarStream2 = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);
    const s3KeyPrefix = `submissions/${submissionId}/media`;
    const uploadedMediaFiles = await extractAndUploadMedia(tarStream2, this.objectStorageService, s3KeyPrefix);
    const tarStream3 = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);
    const codesetS3KeyPrefix = `submissions/${submissionId}/codes`;
    const uploadedCodesetFiles = await extractAndUploadCodesets(
      tarStream3,
      this.objectStorageService,
      codesetS3KeyPrefix
    );

    // Stamp each file/report block with its S3 artifact_key so downstream
    // consumers (download pipeline, UI) can locate the file without a join
    this.setArtifactKeys(allBlocks, uploadedMediaFiles);

    // Pre-compute data_byte_size per feature for download size estimation
    // (avoids fetching full JSONB at query time — see data_byte_size column docs)
    const dataByteSizeMap = this.computeDataByteSizeMap(allBlocks, uploadedMediaFiles);

    // Create artifact records for each uploaded media file
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

    // Create artifact + upload_artifact(codeset role) records for each extracted codeset file.
    for (const [, codesetFile] of uploadedCodesetFiles) {
      const artifact = await this.artifactService.insertArtifact({
        bucket: getObjectStoreBucketName(),
        object_key: codesetFile.s3Key,
        byte_size: codesetFile.byteSize,
        artifact_status: ArtifactStatusEnum.UPLOADED,
        checksum_sha256: null,
        uploaded_at: dayjs().toISOString()
      });

      await this.connection.sql(SQL`
        INSERT INTO upload_artifact (upload_id, artifact_id, role, upload_archive_id)
        VALUES (${uploadId}, ${artifact.artifact_id}, ${UploadArtifactRoleEnum.CODESET}, ${uploadArchiveId})
        ON CONFLICT (upload_id, artifact_id) DO NOTHING;
      `);
    }

    // Soft-delete previous features for this upload, then insert fresh ones.
    // Scoped by submissionUploadId (not submissionId) so re-triggering one upload
    // doesn't wipe features from a different upload in the same submission.
    await this.ingestionRepository.deleteSubmissionFeaturesBySubmissionUploadId(submissionUploadId);
    await this.insertFlatFeatures(submissionId, submissionUploadId, allBlocks, dataByteSizeMap);

    return { valid: true, errors: [] };
  }

  /**
   * Insert flat features using two-pass approach.
   * Pass 1: Insert all features with parent = NULL
   * Pass 2: Update parent references using UUID → ID mapping
   *
   * @private
   * @param {number} submissionId - The submission ID
   * @param {string} submissionUploadId - The submission_upload_id that produced these features
   * @param {IFlattenedBlock[]} features - Features to insert
   * @param {Map<string, number>} dataByteSizeMap - Pre-computed byte sizes per feature UUID
   * @memberof SubmissionIngestionService
   */
  private async insertFlatFeatures(
    submissionId: number,
    submissionUploadId: string,
    features: IFlattenedBlock[],
    dataByteSizeMap: Map<string, number>
  ): Promise<void> {
    const uuidToDbId = new Map<string, number>();

    // Pass 1: Insert all features without parent references
    for (const feature of features) {
      const result = await this.ingestionRepository.insertSubmissionFeatureRecord(
        submissionId,
        submissionUploadId,
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
   * @param {string} uploadId - The upload ID
   * @returns {Promise<string>} The S3 object key
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
