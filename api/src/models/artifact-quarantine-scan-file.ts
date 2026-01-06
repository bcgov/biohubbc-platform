import { z } from 'zod';

export const SecurityResultStatusZod = z.enum(['pending', 'clean', 'infected', 'error', 'skipped']);

export enum SecurityStatusEnum {
  PENDING = 'pending',
  CLEAN = 'clean',
  INFECTED = 'infected',
  ERROR = 'error',
  SKIPPED = 'skipped'
}

/**
 * Full record of a scanned file
 */
export const ArtifactQuarantineScanFile = z.object({
  artifact_quarantine_scan_file_id: z.string().uuid(),
  artifact_quarantine_scan_id: z.string().uuid(),
  file_path: z.string(),
  status: SecurityResultStatusZod
});
export type ArtifactQuarantineScanFile = z.infer<typeof ArtifactQuarantineScanFile>;

/**
 * Payload for creating a new scan file record
 */
export const CreateArtifactQuarantineScanFile = z.object({
  artifact_quarantine_scan_id: z.string().uuid(),
  file_path: z.string(),
  status: SecurityResultStatusZod
});
export type CreateArtifactQuarantineScanFile = z.infer<typeof CreateArtifactQuarantineScanFile>;

/**
 * Payload for updating an existing scan file record
 */
export const UpdateArtifactQuarantineScanFile = z.object({
  artifact_quarantine_scan_id: z.string().uuid().optional(),
  file_path: z.string().optional(),
  status: SecurityResultStatusZod.optional()
});
export type UpdateArtifactQuarantineScanFile = z.infer<typeof UpdateArtifactQuarantineScanFile>;
