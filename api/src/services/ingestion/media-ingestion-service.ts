import dayjs from 'dayjs';
import { IDBConnection } from '../../database/db';
import { ArtifactStatusEnum, BatchUpdateArtifact } from '../../models/artifact';
import { CreateUploadArtifact, UploadArtifactRoleEnum } from '../../models/upload-artifact';
import { streamMedia } from '../../utils/biohub-tar-parser';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArtifactService } from '../upload/upload-artifact-service';

const MEDIA_INGEST_BATCH_BYTES = 50 * 1024 * 1024;
const MEDIA_INGEST_BATCH_FILES = 1000;

/**
 * Ingest media files from tarball to object storage and artifact tables.
 */
export class MediaIngestionService extends DBService {
  objectStorageService = new ObjectStorageService();
  artifactService = new ArtifactService(this.connection);
  uploadArtifactService = new UploadArtifactService(this.connection);

  constructor(connection: IDBConnection) {
    super(connection);
  }

  /**
   * Upload media files and persist artifact plus upload_artifact rows.
   *
   * @param {string} objectKey
   * @param {number} submissionId
   * @param {string} submissionUploadId
   * @param {string} uploadId
   * @param {string} uploadArchiveId
   * @return {Promise<void>}
   */
  async ingestMediaFiles(
    objectKey: string,
    submissionId: number,
    submissionUploadId: string,
    uploadId: string,
    uploadArchiveId: string
  ): Promise<void> {
    // Scope uploaded media under submission + submission upload so each upload attempt
    // lands in a deterministic, isolated key namespace.
    const s3KeyPrefix = `submissions/${submissionId}/uploads/${submissionUploadId}/media`;

    // Batched write buffers:
    // 1) upload_artifact linkage rows (upload_id <-> artifact_id + archive path)
    // 2) artifact status/checksum updates (pending -> uploaded)
    //
    // Keeping these buffered lets us reduce SQL round-trips and avoid generating
    // oversized SQL payloads on very large archives.
    const pendingUploadArtifacts: CreateUploadArtifact[] = [];
    const pendingArtifactUpdates: BatchUpdateArtifact[] = [];
    let pendingUploadArtifactBytes = 0;
    let pendingUpdateBytes = 0;

    // Flush policy: whichever threshold is hit first.
    // - file-count guard protects SQL payload size / parameter fanout
    // - byte-size guard protects memory for large file cohorts
    const shouldFlush = (fileCount: number, totalBytes: number): boolean =>
      fileCount >= MEDIA_INGEST_BATCH_FILES || totalBytes >= MEDIA_INGEST_BATCH_BYTES;

    const flushPendingUploadArtifacts = async (): Promise<void> => {
      if (!pendingUploadArtifacts.length) {
        return;
      }

      // Persist upload_artifact links in one bulk insert and reset byte accounting.
      const currentBatch = pendingUploadArtifacts.splice(0, pendingUploadArtifacts.length);
      pendingUploadArtifactBytes = 0;
      await this.uploadArtifactService.insertUploadArtifacts(currentBatch);
    };

    const flushPendingArtifactUpdates = async (): Promise<void> => {
      if (!pendingArtifactUpdates.length) {
        return;
      }

      // Persist artifact status/checksum transitions in one bulk update.
      const currentBatch = pendingArtifactUpdates.splice(0, pendingArtifactUpdates.length);
      pendingUpdateBytes = 0;
      await this.artifactService.updateArtifactsByIds(currentBatch);
    };

    // Stream tar media in a single pass:
    // - bytes are uploaded to object storage by streamMedia
    // - for each uploaded file we persist DB records in bounded batches
    const tarStream = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);

    await streamMedia(tarStream, {
      objectStorageService: this.objectStorageService,
      s3KeyPrefix,
      batchSize: MEDIA_INGEST_BATCH_FILES,
      maxBatchBytes: MEDIA_INGEST_BATCH_BYTES,
      ingestMediaBatch: async (mediaFiles) => {
        for (const mediaFile of mediaFiles) {
          // Step 1: create artifact stub first (pending status) so we have artifact_id
          // for linkage and auditability even before post-upload metadata is flushed.
          const artifact = await this.artifactService.insertArtifact({
            bucket: getObjectStoreBucketName(),
            object_key: mediaFile.s3Key,
            byte_size: mediaFile.byteSize,
            artifact_status: ArtifactStatusEnum.PENDING,
            checksum_sha256: null,
            uploaded_at: null
          });

          // Step 2: queue upload_artifact lineage row (path is archive-relative files/* path).
          pendingUploadArtifacts.push({
            upload_id: uploadId,
            artifact_id: artifact.artifact_id,
            role: UploadArtifactRoleEnum.ATTACHMENT,
            upload_archive_id: uploadArchiveId,
            path: mediaFile.path
          });
          pendingUploadArtifactBytes += mediaFile.byteSize;

          // Flush linkage rows when either threshold is reached.
          if (shouldFlush(pendingUploadArtifacts.length, pendingUploadArtifactBytes)) {
            await flushPendingUploadArtifacts();
          }

          // Step 3: queue artifact transition to uploaded with checksum + uploaded_at.
          pendingArtifactUpdates.push({
            artifact_id: artifact.artifact_id,
            artifact_status: ArtifactStatusEnum.UPLOADED,
            checksum_sha256: mediaFile.checksumSha256,
            uploaded_at: dayjs().toISOString()
          });
          pendingUpdateBytes += mediaFile.byteSize;

          // Flush artifact updates under the same thresholds.
          if (shouldFlush(pendingArtifactUpdates.length, pendingUpdateBytes)) {
            await flushPendingArtifactUpdates();
          }
        }
      }
    });

    // Final drain for any partial batches left after stream completion.
    await flushPendingUploadArtifacts();
    await flushPendingArtifactUpdates();
  }
}
