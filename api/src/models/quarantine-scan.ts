import { z } from 'zod';

/**
 * Scan status enum
 * Tracks the status of an individual scan attempt
 */
export enum ScanStatusEnum {
  /** Used when scan has not started */
  PENDING = 'pending',
  /** Used when scan is in progress */
  SCANNING = 'scanning',
  /** Used when scan has finished successfully */
  COMPLETED = 'completed',
  /** Used when scan encountered an error */
  ERROR = 'error'
}

/**
 * Interface for creating a new quarantine scan record
 */
export interface IInsertQuarantineScan {
  quarantine_id: string;
  scan_status: ScanStatusEnum;
  scanned_at: string;
  scanner_version?: string;
  results?: Record<string, any>;
}

/**
 * Interface for updating a quarantine scan record
 */
export interface IUpdateQuarantineScan {
  scan_status?: ScanStatusEnum;
  scanned_at?: string;
  scanner_version?: string;
  results?: Record<string, any>;
}

/**
 * Quarantine scan record schema
 */
export const QuarantineScanRecord = z.object({
  quarantine_scan_id: z.string().uuid(),
  quarantine_id: z.string().uuid(),
  scan_status: z.nativeEnum(ScanStatusEnum),
  scanned_at: z.string().nullable(),
  scanner_version: z.string().nullable(),
  results: z.record(z.any()).nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type QuarantineScanRecord = z.infer<typeof QuarantineScanRecord>;

/**
 * Quarantine scan record with file counts
 */
export const QuarantineScanRecordWithCounts = QuarantineScanRecord.extend({
  total_files: z.number(),
  clean_files: z.number(),
  infected_files: z.number(),
  error_files: z.number(),
  pending_files: z.number()
});

export type QuarantineScanRecordWithCounts = z.infer<typeof QuarantineScanRecordWithCounts>;
