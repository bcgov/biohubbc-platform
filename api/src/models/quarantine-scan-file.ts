import { z } from 'zod';

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
  /** Used when file was intentionally not scanned */
  SKIPPED = 'skipped'
}

/**
 * Interface for creating a new quarantine scan file record
 */
export interface IInsertQuarantineScanFile {
  quarantine_scan_id: string;
  file_path: string;
  scan_result: FileScanResultEnum;
}

/**
 * Interface for updating a quarantine scan file record
 */
export interface IUpdateQuarantineScanFile {
  scan_result?: FileScanResultEnum;
}

/**
 * Quarantine scan file record schema
 */
export const QuarantineScanFileRecord = z.object({
  quarantine_scan_file_id: z.string().uuid(),
  quarantine_scan_id: z.string().uuid(),
  file_path: z.string(),
  scan_result: z.nativeEnum(FileScanResultEnum)
});

export type QuarantineScanFileRecord = z.infer<typeof QuarantineScanFileRecord>;
