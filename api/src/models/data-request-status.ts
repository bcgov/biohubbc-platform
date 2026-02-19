import { z } from 'zod';

export const DataRequestStatusEnum = z.enum(['REQUESTED', 'APPROVED', 'DENIED']);
export type DataRequestStatusEnum = z.infer<typeof DataRequestStatusEnum>;

export const DataRequestStatus = z.object({
  data_request_status_id: z.string().uuid(),
  data_request_id: z.string().uuid(),
  comment_id: z.string().uuid().nullable(),
  request_status: DataRequestStatusEnum
});
export type DataRequestStatus = z.infer<typeof DataRequestStatus>;

export const UpdateDataRequestStatus = z.object({
  request_status: DataRequestStatusEnum.optional(),
  comment_id: z.string().uuid().optional()
});
export type UpdateDataRequestStatus = z.infer<typeof UpdateDataRequestStatus>;
