import { z } from 'zod';

export const ArtifactStatusZod = z.enum(['pending', 'uploaded', 'deleted', 'failed', 'archived']);

export enum ArtifactStatusEnum {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  DELETED = 'deleted',
  FAILED = 'failed',
  ARCHIVED = 'archived'
}

/**
 * Artifact table schema
 */
export const Artifact = z.object({
  artifact_id: z.string().uuid(),
  artifact_status: ArtifactStatusZod,
  bucket: z.string().max(200),
  object_key: z.string(),
  byte_size: z.string().nullable(),
  checksum_sha256: z.string().length(64).nullable(),
  uploaded_at: z.string().nullable(),
  format: z.string()
});
export type Artifact = z.infer<typeof Artifact>;

/**
 * Payload for creating a new artifact
 */
export const CreateArtifact = z.object({
  bucket: z.string().max(200),
  artifact_status: ArtifactStatusZod,
  object_key: z.string(),
  byte_size: z.number().int().nullable(),
  checksum_sha256: z.string().length(64).nullable(),
  uploaded_at: z.string().nullable(),
  format: z.string()
});
export type CreateArtifact = z.infer<typeof CreateArtifact>;

/**
 * Payload for updating an existing artifact
 */
export const UpdateArtifact = z.object({
  bucket: z.string().max(200).optional(),
  artifact_status: ArtifactStatusZod.optional(),
  object_key: z.string().optional(),
  byte_size: z.number().int().nullable().optional(),
  checksum_sha256: z.string().length(64).nullable().optional(),
  uploaded_at: z.string().nullable().optional(),
  format: z.string().optional()
});
export type UpdateArtifact = z.infer<typeof UpdateArtifact>;

/**
 * Payload for batch-updating artifacts by id.
 */
export type BatchUpdateArtifact = UpdateArtifact & { artifact_id: string };
