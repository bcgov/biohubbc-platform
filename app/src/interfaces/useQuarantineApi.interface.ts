/**
 * Quarantine status enum
 * Tracks the overall status of a quarantined tarball
 */
export enum QuarantineStatusEnum {
  /** Used for records where files have not been uploaded */
  DRAFT = 'draft',
  /** Used when files are uploaded and awaiting malware scan */
  PENDING = 'pending',
  /** Used when malware scan is in progress */
  SCANNING = 'scanning',
  /** Used when malware scan completed and no threats were found */
  CLEAN = 'clean',
  /** Used when malware scan completed and threats were found */
  INFECTED = 'infected',
  /** Used when malware scan failed due to error */
  FAILED = 'failed'
}

/**
 * File scan result enum
 * Tracks the scan result of an individual file within a tarball
 */
export enum FileScanResultEnum {
  /** Used when file has not been scanned yet */
  PENDING = 'pending',
  /** Used when file was scanned and no threats were found */
  CLEAN = 'clean',
  /** Used when file was scanned and threats were detected */
  INFECTED = 'infected',
  /** Used when file scan encountered an error */
  ERROR = 'error',
  /** Used when file was not scanned (too large, excluded type, etc.) */
  SKIPPED = 'skipped'
}

export interface QuarantineRecordScan {
  quarantine_id: string;
  quarantine_scan_id: string;
  scan_status: FileScanResultEnum;
  scanned_at: string | null;
  scanner_version: string | null;
  results: Record<string, any> | null;
}

export interface QuarantineRecordWithScans {
  quarantine_id: string;
  status: QuarantineStatusEnum;
  scans: QuarantineRecordScan[];
}

export interface SubmissionRecordWithQuarantine {
  submission_id: string;
  name: string;
  description: string;
  submitted_timestamp: string;
  quarantine: QuarantineRecordWithScans;
}

export interface SubmissionRecordWithQuarantineResponse {
  submissions: SubmissionRecordWithQuarantine[];
}

export interface IQuarantineUploadPart {
  partNumber: number;
  etag: string;
}

export interface ICompleteQuarantineUploadMetadata {
  name: string;
  description: string;
  comment: string;
  uid: string;
}

export interface PresignedUrl {
  partNumber: number;
  url: string;
}
export interface PresignedUploadUrlResponse {
  quarantineId: string;
  uploadId: string;
  key: string;
  partSizeBytes: number;
  partCount: number;
  presignedUrls: PresignedUrl[];
}
