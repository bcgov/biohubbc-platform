import { z } from 'zod';
import { ProcessStatusStatusZod } from './process-status';

/**
 * Full record of a quarantine scan
 */
export const ArtifactQuarantineScan = z.object({
  artifact_quarantine_scan_id: z.string().uuid(),
  artifact_quarantine_id: z.string().uuid(),
  status: ProcessStatusStatusZod,
  scanner_version: z.string().nullable(),
  scanned_at: z.string().nullable(),
  results: z.record(z.any()).nullable()
});
export type ArtifactQuarantineScan = z.infer<typeof ArtifactQuarantineScan>;

/**
 * Payload for creating a new scan
 */
export const CreateArtifactQuarantineScan = z.object({
  artifact_quarantine_id: z.string().uuid(),
  status: ProcessStatusStatusZod,
  scanner_version: z.string().nullable(),
  scanned_at: z.string().nullable(),
  results: z.record(z.any()).nullable()
});
export type CreateArtifactQuarantineScan = z.infer<typeof CreateArtifactQuarantineScan>;

/**
 * Payload for updating an existing scan
 */
export const UpdateArtifactQuarantineScan = z.object({
  artifact_quarantine_id: z.string().uuid().optional(),
  status: ProcessStatusStatusZod.optional(),
  scanner_version: z.string().nullable().optional(),
  scanned_at: z.string().nullable().optional(),
  results: z.record(z.any()).nullable().optional()
});
export type UpdateArtifactQuarantineScan = z.infer<typeof UpdateArtifactQuarantineScan>;
