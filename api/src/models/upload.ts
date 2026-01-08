import { z } from 'zod';

export const UploadStatusZod = z.enum(['pending', 'completed', 'aborted', 'expired', 'failed']);

export enum UploadStatusEnum {
  PENDING = 'pending',
  COMPLETED = 'completed',
  ABORTED = 'aborted',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

export const Upload = z.object({
  upload_id: z.string().uuid(),
  status: UploadStatusZod,
  record_end_date: z.string(),
  s3_upload_id: z.string().nullable(),
  create_user: z.number().int()
});
export type Upload = z.infer<typeof Upload>;

export const CreateUpload = z.object({
  status: UploadStatusZod,
  record_end_date: z.string(),
  s3_upload_id: z.string().nullable()
});
export type CreateUpload = z.infer<typeof CreateUpload>;

export const UpdateUpload = z.object({
  status: UploadStatusZod.optional(),
  record_end_date: z.string().optional(),
  s3_upload_id: z.string().optional()
});
export type UpdateUpload = z.infer<typeof UpdateUpload>;
