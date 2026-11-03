import { TERMINAL_UPLOAD_STATUSES } from '../../constants/submission-upload';
import { IDBConnection } from '../../database/db';
import { ArtifactStatusEnum } from '../../models/artifact';
import {
  ArtifactSecurity,
  ArtifactSecurityScanStart,
  CreateArtifactSecurity,
  ScanExecutionResult,
  StartedArtifactSecurityScan,
  UpdateArtifactSecurity
} from '../../models/artifact-security';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { UploadArchive } from '../../models/upload-archive';
import { publishProcessSubmissionFeaturesJob } from '../../queue/publisher';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { sanitizeJsonbValue } from '../../utils/jsonb';
import { DBService } from '../db-service';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactSecurityScanService } from './artifact-security-scan-service';
import { ScanOutcome } from './artifact-security-service.interface';
import { ArtifactService } from './artifact-service';
import { SubmissionUploadService } from './submission-upload-service';
import { UploadArchiveService } from './upload-archive-service';

export class ArtifactSecurityService extends DBService {
  uploadArtifactSecurityRepository: ArtifactSecurityRepository;
  artifactService: ArtifactService;
  artifactSecurityScanService: ArtifactSecurityScanService;
  objectStorageService: ObjectStorageService;
  submissionUploadService: SubmissionUploadService;
  uploadArchiveService: UploadArchiveService;

  /**
   * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
   */
  static readonly dependencies = {
    publishProcessSubmissionFeaturesJob
  };

  /**
   * Initialize the artifact security service and its dependencies.
   *
   * @param {IDBConnection} connection - Active database connection for service operations.
   * @returns {void}
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.uploadArtifactSecurityRepository = new ArtifactSecurityRepository(connection);
    this.artifactService = new ArtifactService(connection);
    this.artifactSecurityScanService = new ArtifactSecurityScanService(connection);
    this.objectStorageService = new ObjectStorageService();
    this.submissionUploadService = new SubmissionUploadService(connection);
    this.uploadArchiveService = new UploadArchiveService(connection);
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
   * Find the latest active security record for an artifact.
   *
   * Returns null when the artifact has not been scanned or queued.
   *
   * @param {string} artifactId - Artifact UUID.
   * @returns {Promise<ArtifactSecurity | null>} Latest active security row, or null when absent.
   * @memberof ArtifactSecurityService
   */
  async findLatestArtifactSecurityByArtifactId(artifactId: string): Promise<ArtifactSecurity | null> {
    return this.uploadArtifactSecurityRepository.findLatestArtifactSecurityByArtifactId(artifactId);
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
   * Perform the irreversible post-clean-scan writes: promote the S3 object from the security bucket to the main
   * bucket, and unblock the upload_archive so extraction can proceed.
   *
   * **Ordering contract.** This method must only be called AFTER `publishNextPipelineStep` has successfully
   * enqueued the downstream submission-processing job. Running it earlier creates an orphan: a CLEAN/promoted
   * artifact with no downstream pipeline step to consume it. See `completeArtifactSecurityScan` for the full ordering.
   *
   * These writes share the completion transaction with the CLEAN security write and the published job, so a
   * failure after `promoteFromSecurity` rolls all of them back. The promote is a copy, so the retried scan
   * re-copies the same object and converges.
   *
   * @param {UploadArchive | null} uploadArchive - The already-looked-up archive record for the artifact, if one exists.
   * @param {string} artifactId - Artifact record to mark as promoted after the copy succeeds.
   * @param {string} objectKey - S3 object key to promote from security to main bucket.
   * @returns {Promise<void>}
   */
  async handleCleanScanResult(
    uploadArchive: UploadArchive | null,
    artifactId: string,
    objectKey: string
  ): Promise<void> {
    await this.objectStorageService.promoteFromSecurity(objectKey);

    await this.artifactService.updateArtifact(artifactId, {
      bucket: getObjectStoreBucketName()
    });

    if (!uploadArchive) {
      return;
    }

    await this.uploadArchiveService.updateUploadArchive(uploadArchive.upload_archive_id, {
      archive_status: ProcessStatusStatusEnum.PENDING
    });
  }

  /**
   * Publish the downstream processing job for a clean scan result.
   *
   * @param {UploadArchive} uploadArchive - Upload archive returned from clean scan handling.
   * @returns {Promise<void>} Resolves once the downstream job is published.
   */
  async publishNextPipelineStep(uploadArchive: UploadArchive): Promise<void> {
    const submissionUpload = await this.submissionUploadService.getSubmissionUploadByUploadId(uploadArchive.upload_id);

    await ArtifactSecurityService.dependencies.publishProcessSubmissionFeaturesJob(this.connection, submissionUpload);
  }

  /**
   * Transition the `submission_upload` owning an artifact security record to `failed`.
   *
   * Resolves the upload via the artifact's `upload_archive` bridge. Used by the malware scan dead letter handler
   * so a scan that fails after all retries does not leave the `submission_upload` stuck at `uploaded`.
   *
   * Tolerant by design so it cannot throw the failure handler into a retry loop: no-op when the artifact has no
   * `upload_archive`, and no-op when the upload has already reached a terminal status.
   *
   * @param {string} artifactSecurityId - Artifact security record identifier.
   * @returns {Promise<void>}
   */
  async failSubmissionUploadByArtifactSecurityId(artifactSecurityId: string): Promise<void> {
    const securityRecord = await this.getArtifactSecurity(artifactSecurityId);

    const uploadArchive = await this.uploadArchiveService.findUploadArchiveByArtifactId(securityRecord.artifact_id);

    if (!uploadArchive) {
      // Non-archive artifact (e.g. a standalone attachment) — no submission_upload lifecycle to fail.
      return;
    }

    const submissionUpload = await this.submissionUploadService.getSubmissionUploadByUploadId(uploadArchive.upload_id);

    if (TERMINAL_UPLOAD_STATUSES.includes(submissionUpload.status)) {
      // Already terminal — nothing to fail.
      return;
    }

    await this.submissionUploadService.transitionSubmissionUploadToFailed(submissionUpload.submission_upload_id);
  }

  /**
   * Start a malware scan for one artifact security record.
   *
   * Validates artifact readiness and inserts a PENDING scan record. Callers commit this before
   * streaming the artifact to ClamAV so no transaction stays open for the length of the scan.
   * Security records that already have a final status are returned unchanged (idempotent), and
   * artifacts that are not uploaded are marked ERROR without a scan.
   *
   * @param {string} artifactSecurityId - Artifact security record identifier.
   * @returns {Promise<ArtifactSecurityScanStart>} The final result, or the started scan to run.
   * @memberof ArtifactSecurityService
   */
  async startArtifactSecurityScan(artifactSecurityId: string): Promise<ArtifactSecurityScanStart> {
    const securityRecord = await this.getArtifactSecurity(artifactSecurityId);
    const artifact = await this.artifactService.getArtifact(securityRecord.artifact_id);

    // Already processed - return existing result (idempotent)
    if (securityRecord.security !== SecurityStatusEnum.PENDING) {
      return {
        status: 'finished',
        result: {
          artifactId: artifact.artifact_id,
          objectKey: artifact.object_key,
          securityStatus: securityRecord.security as SecurityStatusEnum
        }
      };
    }

    if (artifact.artifact_status !== ArtifactStatusEnum.UPLOADED) {
      // Artifact not ready - mark as error and return (don't retry)
      await this.updateArtifactSecurity(artifactSecurityId, {
        security: SecurityStatusEnum.ERROR
      });

      return {
        status: 'finished',
        result: {
          artifactId: artifact.artifact_id,
          objectKey: artifact.object_key,
          securityStatus: SecurityStatusEnum.ERROR
        }
      };
    }

    const { artifact_security_scan_id } = await this.artifactSecurityScanService.insertArtifactSecurityScan({
      artifact_security_id: artifactSecurityId,
      scan_status: ProcessStatusStatusEnum.PENDING,
      scanner_version: null,
      scanned_at: null,
      results: null
    });

    return {
      status: 'started',
      scan: {
        artifactSecurityId,
        artifactSecurityScanId: artifact_security_scan_id,
        artifactId: artifact.artifact_id,
        bucket: artifact.bucket,
        objectKey: artifact.object_key
      }
    };
  }

  /**
   * Persist a completed malware scan and apply its post-scan actions.
   *
   * Updates the scan record and security status. A clean archive publishes its downstream
   * processing job before the irreversible CLEAN, archive unblock, and S3 promote writes.
   *
   * @param {StartedArtifactSecurityScan} scan - The scan started by {@link startArtifactSecurityScan}.
   * @param {ScanOutcome} scanOutcome - ClamAV scan outcome for the artifact.
   * @returns {Promise<ScanExecutionResult>} Final scan execution result summary.
   * @memberof ArtifactSecurityService
   */
  async completeArtifactSecurityScan(
    scan: StartedArtifactSecurityScan,
    scanOutcome: ScanOutcome
  ): Promise<ScanExecutionResult> {
    // The scan ran outside any transaction, so an expired attempt and its retry can both reach completion.
    // Lock the security record and apply only the first result; a later one is kept on its scan row as audit.
    const securityRecord = await this.uploadArtifactSecurityRepository.getArtifactSecurityWithLock(
      scan.artifactSecurityId
    );

    await this.artifactSecurityScanService.updateArtifactSecurityScan(scan.artifactSecurityScanId, {
      scan_status: scanOutcome.scanStatus,
      scanner_version: scanOutcome.scannerVersion,
      scanned_at: scanOutcome.scannedAt,
      results: sanitizeJsonbValue(scanOutcome.results)
    });

    if (securityRecord.security !== SecurityStatusEnum.PENDING) {
      return {
        artifactId: scan.artifactId,
        objectKey: scan.objectKey,
        securityStatus: securityRecord.security as SecurityStatusEnum
      };
    }

    if (scanOutcome.securityStatus === SecurityStatusEnum.CLEAN) {
      // Publish BEFORE any point-of-no-return write (security = CLEAN, archive unblock, S3 promote).
      //
      // If `publishProcessSubmissionFeaturesJob` throws here — e.g. pg-boss's DB is
      // unavailable — the caller's transaction rolls back with nothing CLEAN persisted,
      // the archive stays BLOCKED, and the S3 object stays in the security bucket.
      // pg-boss retries the whole scan; `getArtifactSecurity` still reads `security = PENDING`,
      // so the scan re-runs and converges. Without this ordering, a queue outage at this step
      // leaves a clean artifact with no downstream submission-processing job.
      const uploadArchive = await this.uploadArchiveService.findUploadArchiveByArtifactId(scan.artifactId);

      if (uploadArchive) {
        await this.publishNextPipelineStep(uploadArchive);
      }

      // Point-of-no-return: publish succeeded; now write the CLEAN state and
      // the irreversible S3 + archive writes.
      await this.updateArtifactSecurity(scan.artifactSecurityId, {
        security: SecurityStatusEnum.CLEAN
      });
      await this.handleCleanScanResult(uploadArchive, scan.artifactId, scan.objectKey);
    } else {
      // INFECTED / ERROR / SKIPPED: no publish, no S3 promote, no archive unblock.
      // Write the security status directly — no orphan risk on this branch.
      await this.updateArtifactSecurity(scan.artifactSecurityId, {
        security: scanOutcome.securityStatus
      });
    }

    return {
      artifactId: scan.artifactId,
      objectKey: scan.objectKey,
      securityStatus: scanOutcome.securityStatus
    };
  }

  /**
   * Record a failed malware scan attempt on its scan record for the audit trail.
   *
   * The security record stays PENDING so a retried job starts a new scan.
   *
   * @param {string} artifactSecurityScanId - Scan record created by {@link startArtifactSecurityScan}.
   * @param {unknown} error - The error that failed the scan or its completion.
   * @returns {Promise<void>}
   * @memberof ArtifactSecurityService
   */
  async failArtifactSecurityScan(artifactSecurityScanId: string, error: unknown): Promise<void> {
    const results = error instanceof Error ? sanitizeJsonbValue({ error: error.message }) : 'Unknown error';

    await this.artifactSecurityScanService.updateArtifactSecurityScan(artifactSecurityScanId, {
      scan_status: ProcessStatusStatusEnum.FAILED,
      scanned_at: new Date().toISOString(),
      results
    });
  }
}
