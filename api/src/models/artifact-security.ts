import { z } from 'zod';
import { SecurityStatusZod } from './artifact-security-scan-file';

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
  security: SecurityStatusZod.optional()
});
export type UpdateArtifactSecurity = z.infer<typeof UpdateArtifactSecurity>;

/**
 * Represents a single scan for a securityd artifact
 */
export const ArtifactSecurityScan = z.object({
  artifact_security_scan_id: z.string().uuid(),
  artifact_security_id: z.string().uuid(),
  security: SecurityStatusZod,
  scanner_version: z.string().optional(),
  scanned_at: z.string().optional(),
  results: z.any().optional()
});
export type ArtifactSecurityScan = z.infer<typeof ArtifactSecurityScan>;
