import { z } from 'zod';
import { ProcessStatusStatusZod } from './process-status';

/**
 * UploadArchive table schema
 */
export const UploadArchive = z.object({
  upload_archive_id: z.string().uuid(),
  upload_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  status: ProcessStatusStatusZod
});
export type UploadArchive = z.infer<typeof UploadArchive>;

/**
 * Payload for creating a new UploadArchive
 */
export const CreateUploadArchive = z.object({
  upload_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  status: ProcessStatusStatusZod
});
export type CreateUploadArchive = z.infer<typeof CreateUploadArchive>;

/**
 * Payload for updating an existing UploadArchive
 */
export const UpdateUploadArchive = z.object({
  upload_id: z.string().uuid().optional(),
  artifact_id: z.string().uuid().optional(),
  status: ProcessStatusStatusZod.optional()
});
export type UpdateUploadArchive = z.infer<typeof UpdateUploadArchive>;
