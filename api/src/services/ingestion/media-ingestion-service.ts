import dayjs from 'dayjs';
import { IDBConnection } from '../../database/db';
import { ArtifactStatusEnum } from '../../models/artifact';
import { UploadArtifactRoleEnum } from '../../models/upload-artifact';
import { streamMedia } from '../../utils/biohub-tar-parser';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArtifactService } from '../upload/upload-artifact-service';

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
   * @param {string} uploadId
   * @param {string} uploadArchiveId
   * @return {Promise<void>}
   */
  async ingestMediaFiles(
    objectKey: string,
    submissionId: number,
    uploadId: string,
    uploadArchiveId: string
  ): Promise<void> {
    const tarStream = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);
    await streamMedia(
      tarStream,
      this.objectStorageService,
      `submissions/${submissionId}/media`,
      async (mediaFile) => {
        const artifact = await this.artifactService.insertArtifact({
          bucket: getObjectStoreBucketName(),
          object_key: mediaFile.s3Key,
          byte_size: mediaFile.byteSize,
          artifact_status: ArtifactStatusEnum.UPLOADED,
          checksum_sha256: mediaFile.checksumSha256,
          uploaded_at: dayjs().toISOString()
        });

        await this.uploadArtifactService.insertUploadArtifact({
          upload_id: uploadId,
          artifact_id: artifact.artifact_id,
          role: UploadArtifactRoleEnum.ATTACHMENT,
          upload_archive_id: uploadArchiveId,
          path: mediaFile.path
        });
      }
    );
  }
}
