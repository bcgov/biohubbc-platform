import { z } from 'zod';
import { ProcessStatusStatusZod } from './process-status';

/**
 * UploadArchive table schema
 */
export const UploadArchive = z.object({
  upload_archive_id: z.guid(),
  upload_id: z.guid(),
  artifact_id: z.guid(),
  archive_status: ProcessStatusStatusZod
});
export type UploadArchive = z.infer<typeof UploadArchive>;

/**
 * Payload for creating a new UploadArchive
 */
export const CreateUploadArchive = z.object({
  upload_id: z.guid(),
  artifact_id: z.guid(),
  archive_status: ProcessStatusStatusZod
});
export type CreateUploadArchive = z.infer<typeof CreateUploadArchive>;

/**
 * Payload for updating an existing UploadArchive
 */
export const UpdateUploadArchive = z.object({
  upload_id: z.guid().optional(),
  artifact_id: z.guid().optional(),
  archive_status: ProcessStatusStatusZod.optional()
});
export type UpdateUploadArchive = z.infer<typeof UpdateUploadArchive>;
