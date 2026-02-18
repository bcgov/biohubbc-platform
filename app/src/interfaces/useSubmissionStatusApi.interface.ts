/**
 * Upload session status
 */
export type IUploadStatus = 'pending' | 'completed' | 'aborted' | 'expired' | 'failed';

/**
 * Archive / process status
 */
export type IProcessStatus = 'draft' | 'blocked' | 'pending' | 'completed' | 'failed';

/**
 * Security status for artifact or scan file
 */
export type IArtifactSecurityStatus = 'pending' | 'clean' | 'infected' | 'error' | 'skipped';

/**
 * Upload record
 */
export interface IUpload {
  upload_id: string;
  upload_status: IUploadStatus;
}

/**
 * Archive record (optional)
 */
export interface IUploadArchive {
  upload_archive_id: string;
  archive_status: IProcessStatus;
  byte_size: number | null;
  security: IArtifactSecurityStatus | null;
}

/**
 * Artifact info per role (count + total byte size)
 */
export interface IArtifactInfo {
  count: number;
  byte_size: number;
}

/**
 * Artifacts grouped by role
 */
export interface IArtifactsByRole {
  feature: IArtifactInfo;
  attachment: IArtifactInfo;
}

/**
 * Security scan record for an artifact
 */
export interface IArtifactSecurityScan {
  artifact_security_scan_id: string;
  scan_status: IProcessStatus;
  scanner_version: string | null;
  scanned_at: string | null;
  results: Record<string, any>;
}

/**
 * Security scan result per file in an artifact
 */
export interface IArtifactSecurityScanFile {
  artifact_security_scan_file_id: string;
  file_path: string;
  result: IArtifactSecurityStatus;
}

/**
 * Main submission upload & security status type
 */
export interface ISubmissionUploadStatus {
  submission_id: number;
  upload: IUpload;
  upload_archives: IUploadArchive[];
  artifacts: IArtifactsByRole;
  scans: IArtifactSecurityScan[];
  scan_files: IArtifactSecurityScanFile[];
}
