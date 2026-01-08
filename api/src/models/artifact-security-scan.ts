import { z } from 'zod';
import { ProcessStatusStatusZod } from './process-status';

/**
 * Full record of a security scan
 */
export const ArtifactSecurityScan = z.object({
  artifact_security_scan_id: z.string().uuid(),
  artifact_security_id: z.string().uuid(),
  scan_status: ProcessStatusStatusZod,
  scanner_version: z.string().nullable(),
  scanned_at: z.string().nullable(),
  results: z.record(z.any()).nullable()
});
export type ArtifactSecurityScan = z.infer<typeof ArtifactSecurityScan>;

/**
 * Payload for creating a new scan
 */
export const CreateArtifactSecurityScan = z.object({
  artifact_security_id: z.string().uuid(),
  scan_status: ProcessStatusStatusZod,
  scanner_version: z.string().nullable(),
  scanned_at: z.string().nullable(),
  results: z.record(z.any()).nullable()
});
export type CreateArtifactSecurityScan = z.infer<typeof CreateArtifactSecurityScan>;

/**
 * Payload for updating an existing scan
 */
export const UpdateArtifactSecurityScan = z.object({
  artifact_security_id: z.string().uuid().optional(),
  scan_status: ProcessStatusStatusZod.optional(),
  scanner_version: z.string().nullable().optional(),
  scanned_at: z.string().nullable().optional(),
  results: z.record(z.any()).nullable().optional()
});
export type UpdateArtifactSecurityScan = z.infer<typeof UpdateArtifactSecurityScan>;
