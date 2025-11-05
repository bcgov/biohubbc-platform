import { z } from 'zod';
import { QuarantineScanRecord } from './quarantine-scan';
import { QuarantineScanFileRecord } from './quarantine-scan-file';

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
  ERROR = 'error',
  /** Used when scan is skipped by an admin */
  SKIPPED = 'skipped'
}

/**
 * Interface for creating a new quarantine record
 */
export interface IInsertQuarantine {
  uri: string;
  status: QuarantineStatusEnum;
}

/**
 * Interface for updating a quarantine record
 */
export interface IUpdateQuarantine {
  uri?: string;
  status?: QuarantineStatusEnum;
  upload_id?: string;
}

/**
 * Quarantine record schema
 */
export const QuarantineRecord = z.object({
  quarantine_id: z.string().uuid(),
  uri: z.string(),
  status: z.nativeEnum(QuarantineStatusEnum),
  upload_id: z.string()
});

export type QuarantineRecord = z.infer<typeof QuarantineRecord>;

/**
 * Quarantine record with associated scan information
 */
export const QuarantineRecordWithScans = QuarantineRecord.extend({
  scans: z.array(QuarantineScanRecord)
});

export type QuarantineRecordWithScans = z.infer<typeof QuarantineRecordWithScans>;

/**
 * Quarantine scan record with associated file scan results
 */
export const QuarantineScanRecordWithFiles = QuarantineScanRecord.extend({
  files: z.array(QuarantineScanFileRecord)
});

export type QuarantineScanRecordWithFiles = z.infer<typeof QuarantineScanRecordWithFiles>;
