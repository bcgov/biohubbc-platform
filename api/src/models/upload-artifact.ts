import { z } from 'zod';

export const UploadArtifactRoleZod = z.enum(['feature', 'attachment']);

export enum UploadArtifactRoleEnum {
  FEATURE = 'feature',
  ATTACHMENT = 'attachment'
}

/**
 * UploadArtifact table schema
 */
export const UploadArtifact = z.object({
  upload_artifact_id: z.string().uuid(),
  upload_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  role: UploadArtifactRoleZod,
  upload_archive_id: z.string().uuid().nullable(),
  path: z.string().nullable()
});
export type UploadArtifact = z.infer<typeof UploadArtifact>;

/**
 * Payload for creating a new UploadArtifact
 */
export const CreateUploadArtifact = z.object({
  upload_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  role: UploadArtifactRoleZod,
  upload_archive_id: z.string().uuid().nullable(),
  path: z.string().nullable().optional()
});
export type CreateUploadArtifact = z.infer<typeof CreateUploadArtifact>;

/**
 * Payload for updating an existing UploadArtifact
 */
export const UpdateUploadArtifact = z.object({
  upload_artifact_id: z.string().uuid(),
  upload_id: z.string().uuid().optional(),
  artifact_id: z.string().uuid().optional(),
  role: UploadArtifactRoleZod.optional(),
  upload_archive_id: z.string().uuid().nullable(),
  path: z.string().nullable().optional()
});
export type UpdateUploadArtifact = z.infer<typeof UpdateUploadArtifact>;

export const ArtifactReferenceResolution = z.object({
  path: z.string(),
  artifact_id: z.string().uuid()
});

export type ArtifactReferenceResolution = z.infer<typeof ArtifactReferenceResolution>;
