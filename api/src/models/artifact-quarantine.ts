import { z } from 'zod';
import { SecurityResultStatusZod } from './artifact-quarantine-scan-file';

/**
 * Full record from artifact_quarantine table
 */
export const ArtifactQuarantine = z.object({
  artifact_quarantine_id: z.string().uuid(),
  upload_artifact_id: z.string().uuid(),
  status: SecurityResultStatusZod
});
export type ArtifactQuarantine = z.infer<typeof ArtifactQuarantine>;

/**
 * Payload for inserting a new record
 */
export const CreateArtifactQuarantine = z.object({
  upload_artifact_id: z.string().uuid(),
  status: SecurityResultStatusZod
});
export type CreateArtifactQuarantine = z.infer<typeof CreateArtifactQuarantine>;

/**
 * Payload for updating an existing record
 */
export const UpdateArtifactQuarantine = z.object({
  upload_artifact_id: z.string().uuid().optional(),
  status: SecurityResultStatusZod.optional()
});
export type UpdateArtifactQuarantine = z.infer<typeof UpdateArtifactQuarantine>;

/**
 * Represents a single scan for a quarantined artifact
 */
export const ArtifactQuarantineScan = z.object({
  artifact_quarantine_scan_id: z.string().uuid(),
  artifact_quarantine_id: z.string().uuid(),
  status: SecurityResultStatusZod,
  scanner_version: z.string().optional(),
  scanned_at: z.string().optional(),
  results: z.any().optional()
});
export type ArtifactQuarantineScan = z.infer<typeof ArtifactQuarantineScan>;
