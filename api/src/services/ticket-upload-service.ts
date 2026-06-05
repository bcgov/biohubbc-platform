import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dayjs from 'dayjs';
import { basename, extname } from 'node:path';
import { IDBConnection } from '../database/db';
import { HTTP400, HTTP401, HTTP409 } from '../errors/http-error';
import { Artifact, ArtifactStatusEnum } from '../models/artifact';
import { SecurityStatusEnum } from '../models/security-status';
import { TicketArtifact } from '../models/ticket-artifact';
import { CompleteTicketUpload, CreateTicketUpload, CreateTicketUploadResponse } from '../models/ticket-upload';
import { UploadStatusEnum } from '../models/upload';
import { UploadArtifactRoleEnum } from '../models/upload-artifact';
import { publishMalwareScanJob } from '../queue/publisher';
import { getSecurityObjectStoreBucketName, getSecurityS3ClientPublic } from '../utils/file-utils';
import { DBService } from './db-service';
import { TicketArtifactService } from './ticket-artifact-service';
import { ArtifactSecurityService } from './upload/artifact-security-service';
import { ArtifactService } from './upload/artifact-service';
import { UploadArtifactService } from './upload/upload-artifact-service';
import { UploadService } from './upload/upload-service';

/**
 * Service for uploading files to tickets.
 */
export class TicketUploadService extends DBService {
  uploadService: UploadService;
  artifactService: ArtifactService;
  artifactSecurityService: ArtifactSecurityService;
  ticketArtifactService: TicketArtifactService;
  uploadArtifactService: UploadArtifactService;

  /**
   * Mutable dependency bag used by tests to avoid stubbing protected methods or module namespace exports.
   */
  static readonly dependencies = {
    getQuarantineBucketName: getSecurityObjectStoreBucketName,
    getPresignedUploadUrl: (command: PutObjectCommand) =>
      getSignedUrl(getSecurityS3ClientPublic(), command, { expiresIn: 3600 }),
    publishMalwareScanJob
  };

  constructor(connection: IDBConnection) {
    super(connection);
    this.uploadService = new UploadService(connection);
    this.artifactService = new ArtifactService(connection);
    this.artifactSecurityService = new ArtifactSecurityService(connection);
    this.ticketArtifactService = new TicketArtifactService(connection);
    this.uploadArtifactService = new UploadArtifactService(connection);
  }

  /**
   * Start a ticket file upload.
   *
   * Creates an upload row, a pending artifact in quarantine, and a presigned
   * PUT URL for the browser. The object key is:
   *
   * `tickets/{ticketId}/upload/{uploadId}/{originalFileName}`
   *
   * The file is not downloadable until it is uploaded, scanned clean, and moved
   * to the main bucket.
   *
   * @param {string} ticketId
   * @param {CreateTicketUpload} payload - Original filename, byte size, and optional content type.
   * @returns {Promise<CreateTicketUploadResponse>} Upload ID and quarantine presigned PUT URL.
   * @memberof TicketUploadService
   */
  async initializeTicketUpload(ticketId: string, payload: CreateTicketUpload): Promise<CreateTicketUploadResponse> {
    const { upload_id } = await this.uploadService.insertUpload({
      upload_status: UploadStatusEnum.PENDING,
      record_end_date: dayjs().add(30, 'minute').toISOString(),
      s3_upload_id: null
    });

    const fileName = this.resolveFileName(payload.file_name);
    const objectKey = `tickets/${ticketId}/upload/${upload_id}/${fileName}`;

    const insertedArtifact = await this.artifactService.insertArtifact({
      artifact_status: ArtifactStatusEnum.PENDING,
      bucket: TicketUploadService.dependencies.getQuarantineBucketName(),
      object_key: objectKey,
      byte_size: payload.byte_size,
      checksum_sha256: null,
      uploaded_at: null,
      format: this.resolveFormat(fileName)
    });

    await this.uploadArtifactService.insertUploadArtifacts([
      {
        upload_id,
        artifact_id: insertedArtifact.artifact_id,
        role: UploadArtifactRoleEnum.ATTACHMENT,
        upload_archive_id: null,
        path: null
      }
    ]);

    const presignedUploadUrl = await TicketUploadService.dependencies.getPresignedUploadUrl(
      new PutObjectCommand({
        Bucket: TicketUploadService.dependencies.getQuarantineBucketName(),
        Key: objectKey,
        ContentType: payload.content_type ?? 'application/octet-stream'
      })
    );

    return {
      upload_id,
      presigned_upload_url: presignedUploadUrl
    };
  }

  /**
   * Finish a ticket file upload.
   *
   * Checks the upload can be completed, marks the artifact uploaded, links it
   * to the ticket, and queues malware scanning.
   *
   * @param {string} ticketId
   * @param {string} uploadId
   * @param {CompleteTicketUpload} payload - Client-reported completion status.
   * @returns {Promise<TicketArtifact>} Created or existing active ticket attachment row.
   * @memberof TicketUploadService
   */
  async completeTicketUpload(
    ticketId: string,
    uploadId: string,
    payload: CompleteTicketUpload
  ): Promise<TicketArtifact> {
    this.assertUploadStatusIsUploaded(payload.status);

    await this.assertCanCompleteUpload(uploadId);

    const artifact = this.assertSingleAttachmentArtifact(
      ticketId,
      uploadId,
      await this.uploadArtifactService.getArtifactsByUploadId(uploadId, UploadArtifactRoleEnum.ATTACHMENT)
    );

    const now = dayjs().toISOString();

    await this.uploadService.updateUpload(uploadId, {
      upload_status: UploadStatusEnum.COMPLETED
    });

    // The object is present in quarantine, but not yet downloadable.
    await this.artifactService.updateArtifact(artifact.artifact_id, {
      artifact_status: ArtifactStatusEnum.UPLOADED,
      uploaded_at: now
    });

    const [ticketArtifact] = await this.ticketArtifactService.insertTicketArtifacts(ticketId, [artifact.artifact_id]);

    if (!ticketArtifact) {
      throw new HTTP409('Failed to attach upload to ticket');
    }

    const securityRecord = await this.artifactSecurityService.insertArtifactSecurity({
      artifact_id: artifact.artifact_id,
      security: SecurityStatusEnum.PENDING
    });

    await TicketUploadService.dependencies.publishMalwareScanJob(this.connection, {
      artifactSecurityId: securityRecord.artifact_security_id
    });

    return ticketArtifact;
  }

  /**
   * Check the client-reported upload status.
   *
   * Only `uploaded` means the browser PUT succeeded.
   *
   * @param {string} status
   * @returns {void}
   * @memberof TicketUploadService
   */
  private assertUploadStatusIsUploaded(status: string): void {
    if (status !== 'uploaded') {
      throw new HTTP400('Invalid upload completion status');
    }
  }

  /**
   * Check that this upload can be completed by the current user.
   *
   * The upload must belong to this user, still be pending, and not be expired.
   *
   * @param {string} uploadId
   * @returns {Promise<void>}
   * @memberof TicketUploadService
   */
  private async assertCanCompleteUpload(uploadId: string): Promise<void> {
    const upload = await this.uploadService.getUpload(uploadId);
    const now = dayjs();

    const authorized =
      upload.create_user === this.connection.systemUserId() &&
      upload.upload_status === UploadStatusEnum.PENDING &&
      now.isBefore(upload.record_end_date);

    if (!authorized) {
      throw new HTTP401('Access Denied');
    }
  }

  /**
   * Return the one artifact expected for a direct ticket upload.
   *
   * The upload must have exactly one attachment artifact, and its key must
   * belong to the ticket and upload route being completed.
   *
   * @private
   * @param {string} ticketId
   * @param {string} uploadId
   * @param {Artifact[]} artifacts
   * @returns {Artifact}
   * @memberof TicketUploadService
   */
  private assertSingleAttachmentArtifact(ticketId: string, uploadId: string, artifacts: Artifact[]): Artifact {
    if (!artifacts.length) {
      throw new HTTP401('Access Denied');
    }

    if (artifacts.length > 1) {
      throw new HTTP409('Upload has unexpected attachment artifacts');
    }

    const artifact = artifacts[0];
    const expectedPrefix = `tickets/${ticketId}/upload/${uploadId}/`;

    if (!artifact.object_key.startsWith(expectedPrefix)) {
      throw new HTTP401('Access Denied');
    }

    return artifact;
  }

  /**
   * Read the file extension used for the artifact format.
   *
   * Files without an extension use `bin`.
   *
   * @private
   * @param {string} fileName
   * @returns {string}
   * @memberof TicketUploadService
   */
  private resolveFormat(fileName: string): string {
    const extension = extname(fileName).replace('.', '').toLowerCase();

    return extension || 'bin';
  }

  /**
   * Read the filename used at the end of the object key.
   *
   * Path-like values are reduced to a basename first.
   *
   * @private
   * @param {string} fileName
   * @returns {string}
   * @memberof TicketUploadService
   */
  private resolveFileName(fileName: string): string {
    return basename(fileName.replaceAll('\\', '/')) || fileName;
  }
}
