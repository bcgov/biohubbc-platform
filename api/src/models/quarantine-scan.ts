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
  results: z.record(z.any()).nullable()
});

export type QuarantineScanRecord = z.infer<typeof QuarantineScanRecord>;
