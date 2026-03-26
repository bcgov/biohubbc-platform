import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { JsonValue } from '../../zod-schema/json';

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
  results: JsonValue | null;
}
