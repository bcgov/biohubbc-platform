import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';

/**
 * Result of executing a malware scan.
 */
export interface ScanExecutionResult {
  artifactId: string;
  objectKey: string;
  securityStatus: SecurityStatusEnum;
}

/**
 * Internal scan outcome from ClamAV.
 */
export interface ScanOutcome {
  scanStatus: ProcessStatusStatusEnum;
  securityStatus: SecurityStatusEnum;
  scannedAt: string | null;
  scannerVersion: string | null;
  results: Record<string, unknown> | null;
}