import { IDBConnection } from '../../database/db';
import { ArtifactStatusEnum } from '../../models/artifact';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { UploadArchive } from '../../models/upload-archive';
import { publishProcessSubmissionFeaturesJob } from '../../queue/publisher';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import { getObjectStoreBucketName, getSecurityObjectStoreBucketName, _getClamAvScanner } from '../../utils/file-utils';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactSecurityScanService } from './artifact-security-scan-service';
import { ScanExecutionResult, ScanOutcome } from './artifact-security-service.interface';
import { ArtifactService } from './artifact-service';
import { SubmissionUploadService } from './submission-upload-service';
import { UploadArchiveService } from './upload-archive-service';

export class ArtifactSecurityService extends DBService {
  uploadArtifactSecurityRepository: ArtifactSecurityRepository;

  /**
   * Creates an instance of ArtifactSecurityService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof ArtifactSecurityService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.uploadArtifactSecurityRepository = new ArtifactSecurityRepository(connection);
  }

  /**
   * Retrieves a single upload artifact security record by its ID.
   *
   * @param {string} securityId The ID of the security record
   * @return {Promise<ArtifactSecurity>} The upload artifact security record
   * @memberof ArtifactSecurityService
   */
  async getArtifactSecurity(securityId: string): Promise<ArtifactSecurity> {
    return this.uploadArtifactSecurityRepository.getArtifactSecurity(securityId);
  }

  /**
   * Inserts a new upload artifact security record.
   *
   * @param {CreateArtifactSecurity} security The data for the new security record
   * @return {Promise<ArtifactSecurity>} The newly created security record ID
   * @memberof ArtifactSecurityService
   */
  async insertArtifactSecurity(security: CreateArtifactSecurity): Promise<ArtifactSecurity> {
    return this.uploadArtifactSecurityRepository.insertArtifactSecurity(security);
  }

  /**
   * Inserts artifact security records for all artifacts associated with an upload.
   *
   * @param {string} uploadId The upload session ID
   * @param {Omit<CreateArtifactSecurity, 'artifact_id'>} security The security data (artifact_id is derived from upload)
   * @return {Promise<ArtifactSecurity[]>} The newly created security records
   * @memberof ArtifactSecurityService
   */
  async insertArtifactSecurityByUploadId(
    uploadId: string,
    security: Omit<CreateArtifactSecurity, 'artifact_id'>
  ): Promise<ArtifactSecurity[]> {
    return this.uploadArtifactSecurityRepository.insertArtifactSecurityByUploadId(uploadId, security);
  }

  /**
   * Updates an existing upload artifact security record by ID.
   *
   * @param {string} securityId The ID of the security record to update
   * @param {UpdateArtifactSecurity} security The fields to update
   * @return {Promise<ArtifactSecurity>} The updated security record ID
   * @memberof ArtifactSecurityService
   */
  async updateArtifactSecurity(securityId: string, security: UpdateArtifactSecurity): Promise<ArtifactSecurity> {
    return this.uploadArtifactSecurityRepository.updateArtifactSecurity(securityId, security);
  }

  /**
   * Handles post-scan actions for a clean scan result.
   * Promotes the file from security bucket to main bucket and unblocks the upload archive for extraction.
   *
   * @param {string} artifactId The ID of the artifact
   * @param {string} objectKey The S3 object key
   * @memberof ArtifactSecurityService
   */
  async handleCleanScanResult(artifactId: string, objectKey: string): Promise<UploadArchive> {
    const uploadArchiveService = new UploadArchiveService(this.connection);
    const uploadArchive = await uploadArchiveService.getUploadArchiveByArtifactId(artifactId);

    // 1. Copy file from security bucket to main bucket
    const storageService = new ObjectStorageService();
    await storageService.promoteFromSecurity(objectKey);

    // 2. Unblock the upload_archive for extraction
    await uploadArchiveService.updateUploadArchive(uploadArchive.upload_archive_id, {
      archive_status: ProcessStatusStatusEnum.PENDING
    });

    return uploadArchive;
  }

  /**
   * Publishes the downstream processing job after a clean scan.
   *
   * submission_upload is created atomically in completeArchiveUpload before the scan
   * job is published — a missing record means data corruption, not a valid state.
   *
   * @param {UploadArchive} uploadArchive The upload archive record from handleCleanScanResult
   * @memberof ArtifactSecurityService
   */
  async publishNextPipelineStep(uploadArchive: UploadArchive): Promise<void> {
    const submissionUploadService = new SubmissionUploadService(this.connection);
    const submissionUpload = await submissionUploadService.getSubmissionUploadByUploadId(uploadArchive.upload_id);

    await publishProcessSubmissionFeaturesJob(this.connection, submissionUpload);
  }

  /**
   * Executes a malware scan for an artifact.
   * Validates the artifact, runs ClamAV scan, records results, and handles post-scan actions.
   *
   * @param {string} artifactSecurityId The ID of the artifact security record
   * @return {Promise<ScanExecutionResult>} The scan result with artifact info and security status
   * @memberof ArtifactSecurityService
   */
  async executeScan(artifactSecurityId: string): Promise<ScanExecutionResult> {
    const artifactService = new ArtifactService(this.connection);
    const artifactSecurityScanService = new ArtifactSecurityScanService(this.connection);

    // 1. Get artifact info and validate
    const securityRecord = await this.getArtifactSecurity(artifactSecurityId);
    const artifact = await artifactService.getArtifact(securityRecord.artifact_id);

    // Already processed - return existing result (idempotent)
    if (securityRecord.security !== SecurityStatusEnum.PENDING) {
      return {
        artifactId: artifact.artifact_id,
        objectKey: artifact.object_key,
        securityStatus: securityRecord.security as SecurityStatusEnum
      };
    }

    if (artifact.artifact_status !== ArtifactStatusEnum.UPLOADED) {
      // Artifact not ready - mark as error and return (don't retry)
      await this.updateArtifactSecurity(artifactSecurityId, {
        security: SecurityStatusEnum.ERROR
      });

      return {
        artifactId: artifact.artifact_id,
        objectKey: artifact.object_key,
        securityStatus: SecurityStatusEnum.ERROR
      };
    }

    // 2. Create scan record (PENDING)
    const { artifact_security_scan_id } = await artifactSecurityScanService.insertArtifactSecurityScan({
      artifact_security_id: artifactSecurityId,
      scan_status: ProcessStatusStatusEnum.PENDING,
      scanner_version: null,
      scanned_at: null,
      results: null
    });

    try {
      // 3. Run the scan
      const scanOutcome = await this.scanArtifactObject(artifact.bucket, artifact.object_key);

      // 4. Update scan record with results
      await artifactSecurityScanService.updateArtifactSecurityScan(artifact_security_scan_id, {
        scan_status: scanOutcome.scanStatus,
        scanner_version: scanOutcome.scannerVersion,
        scanned_at: scanOutcome.scannedAt,
        results: scanOutcome.results
      });

      // 5. Update artifact security status
      await this.updateArtifactSecurity(artifactSecurityId, {
        security: scanOutcome.securityStatus
      });

      // 6. Handle post-scan actions for clean files
      if (scanOutcome.securityStatus === SecurityStatusEnum.CLEAN) {
        const uploadArchive = await this.handleCleanScanResult(artifact.artifact_id, artifact.object_key);
        await this.publishNextPipelineStep(uploadArchive);
      }

      return {
        artifactId: artifact.artifact_id,
        objectKey: artifact.object_key,
        securityStatus: scanOutcome.securityStatus
      };
    } catch (error) {
      // Update scan record to FAILED
      await artifactSecurityScanService.updateArtifactSecurityScan(artifact_security_scan_id, {
        scan_status: ProcessStatusStatusEnum.FAILED,
        scanned_at: new Date().toISOString(),
        results: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      // Commit the FAILED scan record to preserve the audit trail
      await this.connection.commit();

      throw error;
    }
  }

  /**
   * Determines the bucket type based on bucket name.
   */
  private getBucketTypeForArtifact(bucketName: string): BucketType {
    if (bucketName === getSecurityObjectStoreBucketName()) {
      return BucketType.QUARANTINE;
    }

    if (bucketName === getObjectStoreBucketName()) {
      return BucketType.MAIN;
    }

    throw new Error(`Unsupported artifact bucket: ${bucketName}`);
  }

  /**
   * Scans an artifact object using ClamAV.
   */
  private async scanArtifactObject(bucketName: string, objectKey: string): Promise<ScanOutcome> {
    const scannedAt = new Date().toISOString();

    const storageService = new ObjectStorageService();
    const bucketType = this.getBucketTypeForArtifact(bucketName);
    const fileStream = await storageService.getFileStream(bucketType, objectKey);

    const clamAvScanner = await _getClamAvScanner();
    const clamavScanResult = await clamAvScanner.scanStream(fileStream);
    const isInfected = Boolean((clamavScanResult as { isInfected?: boolean }).isInfected);

    // Extract only the fields we need (avoids null bytes in resultString that PostgreSQL JSONB rejects)
    const scanResults = {
      isInfected,
      viruses: (clamavScanResult as { viruses?: string[] }).viruses ?? [],
      timeout: (clamavScanResult as { timeout?: boolean }).timeout ?? false
    };

    return {
      scanStatus: ProcessStatusStatusEnum.COMPLETED,
      securityStatus: isInfected ? SecurityStatusEnum.INFECTED : SecurityStatusEnum.CLEAN,
      scannedAt,
      scannerVersion: null,
      results: scanResults
    };
  }
}
