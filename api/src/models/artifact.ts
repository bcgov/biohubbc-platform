import { z } from 'zod';

export const ArtifactStatusZod = z.enum(['draft', 'pending', 'completed', 'failed']);

export enum ArtifactStatusEnum {
  DRAFT = 'draft',
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Artifact table schema
 */
export const Artifact = z.object({
  artifact_id: z.string().uuid(),
  status: ArtifactStatusZod,
  bucket: z.string().max(200),
  object_key: z.string(),
  byte_size: z.number().int().nullable(),
  checksum_sha256: z.string().length(64).nullable(),
  uploaded_at: z.string().nullable()
});
export type Artifact = z.infer<typeof Artifact>;

/**
 * Payload for creating a new artifact
 */
export const CreateArtifact = z.object({
  bucket: z.string().max(200),
  status: ArtifactStatusZod,
  object_key: z.string(),
  byte_size: z.number().int().nullable(),
  checksum_sha256: z.string().length(64).nullable(),
  uploaded_at: z.string().nullable()
});
export type CreateArtifact = z.infer<typeof CreateArtifact>;

/**
 * Payload for updating an existing artifact
 */
export const UpdateArtifact = z.object({
  bucket: z.string().max(200).optional(),
  status: ArtifactStatusZod.optional(),
  object_key: z.string().optional(),
  byte_size: z.number().int().nullable().optional(),
  checksum_sha256: z.string().length(64).nullable().optional(),
  uploaded_at: z.string().nullable().optional()
});
export type UpdateArtifact = z.infer<typeof UpdateArtifact>;
