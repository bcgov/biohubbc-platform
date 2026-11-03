import { z } from 'zod';
import { SecurityStatusEnum, SecurityStatusZod } from './security-status';

/**
 * Full record from artifact_security table
 */
export const ArtifactSecurity = z.object({
  artifact_security_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  security: SecurityStatusZod
});
export type ArtifactSecurity = z.infer<typeof ArtifactSecurity>;

/**
 * Payload for inserting a new record
 */
export const CreateArtifactSecurity = z.object({
  artifact_id: z.string().uuid(),
  security: SecurityStatusZod
});
export type CreateArtifactSecurity = z.infer<typeof CreateArtifactSecurity>;

/**
 * Payload for updating an existing record
 */
export const UpdateArtifactSecurity = z.object({
  artifact_id: z.string().uuid().optional(),
  security: SecurityStatusZod.optional(),
  record_end_date: z.string().nullable().optional()
});
export type UpdateArtifactSecurity = z.infer<typeof UpdateArtifactSecurity>;

/**
 * Result of executing a malware scan.
 */
export interface ScanExecutionResult {
  artifactId: string;
  objectKey: string;
  securityStatus: SecurityStatusEnum;
}

/**
 * A scan whose PENDING scan record is committed and whose artifact is ready to stream to ClamAV.
 */
export interface StartedArtifactSecurityScan {
  artifactSecurityId: string;
  artifactSecurityScanId: string;
  artifactId: string;
  bucket: string;
  objectKey: string;
}

/**
 * Outcome of starting a malware scan: either the security record already has a final result,
 * or a scan record was created and the artifact must be scanned.
 */
export type ArtifactSecurityScanStart =
  | { status: 'finished'; result: ScanExecutionResult }
  | { status: 'started'; scan: StartedArtifactSecurityScan };
