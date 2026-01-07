import { z } from 'zod';
import { SecurityStatusZod } from './security-status';

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
