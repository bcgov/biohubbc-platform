import { z } from 'zod';

export const CreateTicketUpload = z.object({
  file_name: z.string().min(1).max(255),
  byte_size: z.number().int().positive(),
  content_type: z.string().min(1).max(255).optional()
});

export type CreateTicketUpload = z.infer<typeof CreateTicketUpload>;

export const CreateTicketUploadResponse = z.object({
  upload_id: z.string().uuid(),
  presigned_upload_url: z.string().url()
});

export type CreateTicketUploadResponse = z.infer<typeof CreateTicketUploadResponse>;

export const CompleteTicketUpload = z.object({
  status: z.enum(['uploaded'])
});

export type CompleteTicketUpload = z.infer<typeof CompleteTicketUpload>;
