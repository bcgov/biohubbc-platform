import { z } from 'zod';
import { SecurityStatusZod } from './security-status';

/**
 * Full record of a scanned file
 */
export const ArtifactSecurityScanFile = z.object({
  artifact_security_scan_file_id: z.string().uuid(),
  artifact_security_scan_id: z.string().uuid(),
  file_path: z.string(),
  security: SecurityStatusZod
});
export type ArtifactSecurityScanFile = z.infer<typeof ArtifactSecurityScanFile>;

/**
 * Payload for creating a new scan file record
 */
export const CreateArtifactSecurityScanFile = z.object({
  artifact_security_scan_id: z.string().uuid(),
  file_path: z.string(),
  security: SecurityStatusZod
});
export type CreateArtifactSecurityScanFile = z.infer<typeof CreateArtifactSecurityScanFile>;

/**
 * Payload for updating an existing scan file record
 */
export const UpdateArtifactSecurityScanFile = z.object({
  artifact_security_scan_id: z.string().uuid().optional(),
  file_path: z.string().optional(),
  security: SecurityStatusZod.optional()
});
export type UpdateArtifactSecurityScanFile = z.infer<typeof UpdateArtifactSecurityScanFile>;
