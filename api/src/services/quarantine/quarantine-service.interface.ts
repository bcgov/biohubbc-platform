import { FileScanResultEnum } from '../../models/quarantine-scan-file';

/**
 * Represents a single scanned file entry within a quarantine scan.
 */
export interface IScannedQuarantineScanFileRecord {
  quarantine_scan_id: string;
  file_path: string;
  scan_result: FileScanResultEnum;
}

/**
 * Summary of results produced from scanning a tar stream.
 */
export interface IScanSummary {
  hasInfection: boolean;
  totalFiles: number;
  infectedCount: number;
  viruses: string[];
  fileRecords: IScannedQuarantineScanFileRecord[];
}

/**
 * Payload for updating or finalizing a quarantine scan.
 */
export interface IFinalizeScanParams {
  quarantineScanId: string;
  quarantineId: string;
  scanSummary: IScanSummary;
  scannerVersion: string;
}
