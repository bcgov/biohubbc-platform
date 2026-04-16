import dayjs from 'dayjs';
import mime from 'mime';
import { IDBConnection } from '../../database/db';
import { ArtifactStatusEnum, BatchUpdateArtifact, CreateArtifact } from '../../models/artifact';
import { CreateUploadArtifact, UploadArtifactRoleEnum } from '../../models/upload-artifact';
import { streamMedia } from '../../utils/biohub-tar-parser';
import { IUploadedMediaFile } from '../../utils/biohub-tar-parser.interface';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { getLogger } from '../../utils/logger';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArtifactService } from '../upload/upload-artifact-service';

const MEDIA_INGEST_BATCH_BYTES = Number(process.env.MEDIA_INGEST_BATCH_BYTES ?? 50 * 1024 * 1024);
const MEDIA_INGEST_BATCH_FILES = Number(process.env.MEDIA_INGEST_BATCH_FILES ?? 10000);
const defaultLog = getLogger('services/ingestion/media-ingestion-service');

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
    const startTime = Date.now();

    defaultLog.debug({
      label: 'ingestMediaFiles',
      message: 'Starting media ingestion',
      submissionId,
      submissionUploadId,
      uploadId,
      uploadArchiveId,
      objectKey
    });

    // Scope uploaded media under submission + submission upload so each upload attempt
    // lands in a deterministic, isolated key namespace.
    const s3KeyPrefix = `submissions/${submissionId}/uploads/${submissionUploadId}/media`;

    // Stream tar media in a single pass:
    // - bytes are uploaded to object storage by streamMedia
    // - for each uploaded file we persist DB records in bounded batches
    defaultLog.debug({
      label: 'ingestMediaFiles',
      message: 'Opening tar stream for media pass',
      submissionUploadId,
      objectKey
    });
    const tarStream = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);

    const { uploadedCount } = await streamMedia(tarStream, {
      objectStorageService: this.objectStorageService,
      s3KeyPrefix,
      batchSize: MEDIA_INGEST_BATCH_FILES,
      maxBatchBytes: MEDIA_INGEST_BATCH_BYTES,
      ingestMediaBatch: async (mediaFiles) =>
        this.persistUploadedMediaBatch(uploadId, uploadArchiveId, submissionUploadId, mediaFiles)
    });

    defaultLog.debug({
      label: 'ingestMediaFiles',
      message: 'Completed tar media stream pass',
      submissionUploadId,
      uploadedCount
    });

    defaultLog.info({
      label: 'ingestMediaFiles',
      message: 'Completed media ingestion',
      submissionUploadId,
      uploadedCount,
      elapsedMs: Date.now() - startTime
    });
  }

  /**
   * Persist one uploaded media batch with bulk artifact insert + linkage + status update.
   *
   * @param {string} uploadId
   * @param {string} uploadArchiveId
   * @param {string} submissionUploadId
   * @param {IUploadedMediaFile[]} mediaFiles
   * @returns {Promise<void>}
   */
  async persistUploadedMediaBatch(
    uploadId: string,
    uploadArchiveId: string,
    submissionUploadId: string,
    mediaFiles: IUploadedMediaFile[]
  ): Promise<void> {
    if (!mediaFiles.length) {
      return;
    }

    const artifactPayloads: CreateArtifact[] = mediaFiles.map((mediaFile) => ({
      bucket: getObjectStoreBucketName(),
      object_key: mediaFile.s3Key,
      byte_size: mediaFile.byteSize,
      artifact_status: ArtifactStatusEnum.PENDING,
      checksum_sha256: null,
      uploaded_at: null,
      format: mime.getExtension(mediaFile.mimetype) ?? 'bin'
    }));

    const insertedArtifacts = await this.artifactService.insertArtifacts(artifactPayloads);
    const artifactIdByObjectKey = new Map(insertedArtifacts.map((artifact) => [artifact.object_key, artifact.artifact_id]));

    const uploadArtifacts: CreateUploadArtifact[] = [];
    const artifactUpdates: BatchUpdateArtifact[] = [];
    const uploadedAt = dayjs().toISOString();

    for (const mediaFile of mediaFiles) {
      const artifactId = artifactIdByObjectKey.get(mediaFile.s3Key);
      if (!artifactId) {
        throw new Error(`Failed to resolve artifact_id for media object_key=${mediaFile.s3Key}`);
      }

      uploadArtifacts.push({
        upload_id: uploadId,
        artifact_id: artifactId,
        role: UploadArtifactRoleEnum.ATTACHMENT,
        upload_archive_id: uploadArchiveId,
        path: mediaFile.path
      });

      artifactUpdates.push({
        artifact_id: artifactId,
        artifact_status: ArtifactStatusEnum.UPLOADED,
        checksum_sha256: mediaFile.checksumSha256,
        uploaded_at: uploadedAt
      });
    }

    await this.uploadArtifactService.insertUploadArtifacts(uploadArtifacts);
    await this.artifactService.updateArtifactsByIds(artifactUpdates);

    const batchBytes = mediaFiles.reduce((acc, mediaFile) => acc + mediaFile.byteSize, 0);
    defaultLog.debug({
      label: 'persistUploadedMediaBatch',
      message: 'Persisted uploaded media batch',
      submissionUploadId,
      batchSize: mediaFiles.length,
      batchBytes
    });
  }
}
