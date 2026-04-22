import { HeadObjectCommandOutput } from '@aws-sdk/client-s3';
import { IDBConnection } from '../../database/db';
import { ClamAvScanValidationError } from '../../errors/clamav-errors';
import { ArtifactStatusEnum } from '../../models/artifact';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { UploadArchive } from '../../models/upload-archive';
import { publishProcessSubmissionFeaturesJob } from '../../queue/publisher';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import { _getClamAvScanner, getObjectStoreBucketName, getSecurityObjectStoreBucketName } from '../../utils/file-utils';
import { sanitizeJsonbValue } from '../../utils/jsonb';
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
   * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
   */
  static readonly dependencies = {
    publishProcessSubmissionFeaturesJob,
    getClamAvScanner: _getClamAvScanner
  };

  /**
   * Initialize the artifact security service and its repository dependency.
   *
   * @param {IDBConnection} connection - Active database connection for service operations.
   * @returns {void}
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.uploadArtifactSecurityRepository = new ArtifactSecurityRepository(connection);
  }

  /**
   * Fetch a single artifact security record by id.
   *
   * @param {string} securityId - Artifact security identifier.
   * @returns {Promise<ArtifactSecurity>} Resolved artifact security record.
   */
  async getArtifactSecurity(securityId: string): Promise<ArtifactSecurity> {
    return this.uploadArtifactSecurityRepository.getArtifactSecurity(securityId);
  }

  /**
   * Create a new artifact security record.
   *
   * @param {CreateArtifactSecurity} security - Payload for the new security record.
   * @returns {Promise<ArtifactSecurity>} Created artifact security record.
   */
  async insertArtifactSecurity(security: CreateArtifactSecurity): Promise<ArtifactSecurity> {
    return this.uploadArtifactSecurityRepository.insertArtifactSecurity(security);
  }

  /**
   * Create artifact security records for all artifacts linked to an upload.
   *
   * @param {string} uploadId - Upload session id.
   * @param {Omit<CreateArtifactSecurity, 'artifact_id'>} security - Security payload shared across derived artifact records.
   * @returns {Promise<ArtifactSecurity[]>} Created artifact security records.
   */
  async insertArtifactSecurityByUploadId(
    uploadId: string,
    security: Omit<CreateArtifactSecurity, 'artifact_id'>
  ): Promise<ArtifactSecurity[]> {
    return this.uploadArtifactSecurityRepository.insertArtifactSecurityByUploadId(uploadId, security);
  }

  /**
   * Update a single artifact security record by id.
   *
   * @param {string} securityId - Artifact security identifier to update.
   * @param {UpdateArtifactSecurity} security - Partial security update payload.
   * @returns {Promise<ArtifactSecurity>} Updated artifact security record.
   */
  async updateArtifactSecurity(securityId: string, security: UpdateArtifactSecurity): Promise<ArtifactSecurity> {
    return this.uploadArtifactSecurityRepository.updateArtifactSecurity(securityId, security);
  }

  /**
   * Handle post-scan actions for a clean artifact.
   *
   * Promotes the object from quarantine to main storage and unblocks the corresponding upload archive.
   *
   * @param {string} artifactId - Artifact identifier.
   * @param {string} objectKey - S3 object key for the artifact.
   * @returns {Promise<UploadArchive>} Updated upload archive record after unblocking.
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
   * Publish the downstream processing job for a clean scan result.
   *
   * @param {UploadArchive} uploadArchive - Upload archive returned from clean scan handling.
   * @returns {Promise<void>} Resolves once the downstream job is published.
   */
  async publishNextPipelineStep(uploadArchive: UploadArchive): Promise<void> {
    const submissionUploadService = new SubmissionUploadService(this.connection);
    const submissionUpload = await submissionUploadService.getSubmissionUploadByUploadId(uploadArchive.upload_id);

    await ArtifactSecurityService.dependencies.publishProcessSubmissionFeaturesJob(this.connection, submissionUpload);
  }

  /**
   * Execute end-to-end malware scanning for one artifact security record.
   *
   * This method validates artifact readiness, inserts a scan record, runs ClamAV, persists results,
   * updates security status, and triggers the next pipeline step when clean.
   *
   * @param {string} artifactSecurityId - Artifact security record identifier.
   * @returns {Promise<ScanExecutionResult>} Final scan execution result summary.
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
        results: sanitizeJsonbValue(scanOutcome.results)
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
      const results = error instanceof Error ? sanitizeJsonbValue({ error: error.message }) : 'Unknown error';

      // Update scan record to FAILED
      await artifactSecurityScanService.updateArtifactSecurityScan(artifact_security_scan_id, {
        scan_status: ProcessStatusStatusEnum.FAILED,
        scanned_at: new Date().toISOString(),
        results
      });

      // Commit the FAILED scan record to preserve the audit trail
      await this.connection.commit();

      throw error;
    }
  }

  /**
   * Map a persisted bucket name to an internal bucket type enum.
   *
   * @param {string} bucketName - Bucket name stored with the artifact record.
   * @returns {BucketType} Bucket type used by object storage service operations.
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
   * Resolve the configured maximum scan size in bytes.
   *
   * Falls back to 20MB when `CLAMAV_MAX_SCAN_SIZE` is not set.
   *
   * ClamAV has two related limits:
   * - `MaxFileSize`: maximum size of any single file ClamAV will inspect (including files extracted from archives).
   * - `MaxScanSize`: maximum total bytes ClamAV will process while scanning one input (including recursive archive extraction).
   *
   * Files over these limits may be skipped/truncated by ClamAV instead of being fully scanned. We pre-check
   * the object size against this application limit so oversized files fail validation before scan submission.
   *
   * @see https://github.com/Cisco-Talos/clamav/issues/1274
   *
   * @returns {number} Maximum allowed scan size in bytes.
   */
  private getClamAvMaxScanSize(): number {
    const maxScanSize = Number(process.env.CLAMAV_MAX_SCAN_SIZE ?? 20 * 1024 * 1024);

    if (!Number.isFinite(maxScanSize) || maxScanSize <= 0) {
      throw new ClamAvScanValidationError('CLAMAV_MAX_SCAN_SIZE must be a positive number of bytes');
    }

    return maxScanSize;
  }

  /**
   * Validate object metadata before attempting ClamAV scan.
   *
   * This is a fail-fast guardrail so we do not send objects to ClamAV that are known to be unscannable under our configured
   * limits. It validates:
   * - file size is present and numeric (`ContentLength` from S3 HEAD metadata)
   * - file size does not exceed `CLAMAV_MAX_SCAN_SIZE`
   *
   * Rejecting here provides a deterministic validation error instead of relying on ClamAV's limit handling (which may skip or
   * partially process oversized content depending on daemon configuration).
   *
   * @param {string} objectKey - S3 key used for error context.
   * @param {HeadObjectCommandOutput} metadata - Object metadata returned by S3 HEAD request.
   * @throws {ClamAvScanValidationError} When file size is missing/non-numeric or exceeds `CLAMAV_MAX_SCAN_SIZE`.
   * @returns {void}
   */
  private validateObjectBeforeScan(objectKey: string, metadata: HeadObjectCommandOutput): void {
    const maxScanSize = this.getClamAvMaxScanSize();
    const fileSize = metadata.ContentLength;

    if (!Number.isFinite(fileSize)) {
      throw new ClamAvScanValidationError(`Cannot determine file size for ClamAV scan: ${objectKey}`);
    }

    if (Number(fileSize) > maxScanSize) {
      throw new ClamAvScanValidationError(`File size ${Number(fileSize)} exceeds CLAMAV_MAX_SCAN_SIZE ${maxScanSize}`);
    }
  }

  /**
   * Scan a stored artifact object with ClamAV and map result to scan outcome.
   *
   * @param {string} bucketName - Bucket name containing the artifact.
   * @param {string} objectKey - Object key for the artifact.
   * @returns {Promise<ScanOutcome>} Scan status and security outcome payload.
   */
  private async scanArtifactObject(bucketName: string, objectKey: string): Promise<ScanOutcome> {
    const scannedAt = new Date().toISOString();

    const storageService = new ObjectStorageService();
    const bucketType = this.getBucketTypeForArtifact(bucketName);
    const metadata = await storageService.getMetadata(bucketType, objectKey);
    this.validateObjectBeforeScan(objectKey, metadata);

    const fileStream = await storageService.getFileStream(bucketType, objectKey);

    const clamAvScanner = await ArtifactSecurityService.dependencies.getClamAvScanner();
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
