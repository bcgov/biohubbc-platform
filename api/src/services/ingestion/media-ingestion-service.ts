import dayjs from 'dayjs';
import mime from 'mime';
import { INGESTION_MEDIA_BATCH_BYTES, INGESTION_MEDIA_BATCH_FILES } from '../../constants/ingestion';
import { IDBConnection } from '../../database/db';
import { ArtifactStatusEnum, CreateArtifact } from '../../models/artifact';
import { CreateUploadArtifact, UploadArtifactRoleEnum } from '../../models/upload-artifact';
import { IUploadedMediaFile } from '../../utils/biohub-tar-parser.interface';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { getLogger } from '../../utils/logger';
import { DBService } from '../db-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArtifactService } from '../upload/upload-artifact-service';

export { INGESTION_MEDIA_BATCH_BYTES, INGESTION_MEDIA_BATCH_FILES };
const defaultLog = getLogger('services/ingestion/media-ingestion-service');

/**
 * Persist uploaded media metadata into artifact and upload_artifact tables.
 */
export class MediaIngestionService extends DBService {
  artifactService = new ArtifactService(this.connection);
  uploadArtifactService = new UploadArtifactService(this.connection);

  constructor(connection: IDBConnection) {
    super(connection);
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

    const uploadedAt = dayjs().toISOString();
    const artifactPayloads: CreateArtifact[] = mediaFiles.map((mediaFile) => ({
      bucket: getObjectStoreBucketName(),
      object_key: mediaFile.s3Key,
      byte_size: mediaFile.byteSize,
      artifact_status: ArtifactStatusEnum.UPLOADED,
      checksum_sha256: mediaFile.checksumSha256,
      uploaded_at: uploadedAt,
      format: mime.getExtension(mediaFile.mimetype) ?? 'bin'
    }));

    const insertedArtifacts = await this.artifactService.insertArtifacts(artifactPayloads);
    const artifactIdByObjectKey = new Map(
      insertedArtifacts.map((artifact) => [artifact.object_key, artifact.artifact_id])
    );

    const uploadArtifacts: CreateUploadArtifact[] = [];

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
    }

    await this.uploadArtifactService.insertUploadArtifacts(uploadArtifacts);

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
