import dayjs from 'dayjs';
import SQL from 'sql-template-strings';
import { IDBConnection } from '../../database/db';
import { ArtifactStatusEnum } from '../../models/artifact';
import { UploadArtifactRoleEnum } from '../../models/upload-artifact';
import { streamMediaFromTarball } from '../../utils/biohub-tar-parser';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';

/**
 * Ingest media files from tarball to object storage and artifact tables.
 */
export class MediaIngestionService extends DBService {
  objectStorageService = new ObjectStorageService();
  artifactService = new ArtifactService(this.connection);

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
    await streamMediaFromTarball(
      tarStream,
      this.objectStorageService,
      `submissions/${submissionId}/media`,
      async (mediaFile) => {
        const artifact = await this.artifactService.insertArtifact({
          bucket: getObjectStoreBucketName(),
          object_key: mediaFile.s3Key,
          byte_size: mediaFile.byteSize,
          artifact_status: ArtifactStatusEnum.UPLOADED,
          checksum_sha256: null,
          uploaded_at: dayjs().toISOString()
        });

        await this.connection.sql(SQL`
        INSERT INTO upload_artifact (upload_id, artifact_id, role, upload_archive_id)
        VALUES (${uploadId}, ${artifact.artifact_id}, ${UploadArtifactRoleEnum.FEATURE}, ${uploadArchiveId})
        ON CONFLICT (upload_id, artifact_id) DO NOTHING;
      `);
      }
    );
  }
}
