import { z } from 'zod';

export const DataRequestStatusEnum = z.enum(['REQUESTED', 'APPROVED', 'DENIED']);
export type DataRequestStatusEnum = z.infer<typeof DataRequestStatusEnum>;

export const DataRequest = z.object({
  data_request_id: z.string().uuid(),
  reason: z.string(),
  team_id: z.string().uuid(),
  requested_by: z.number()
});
export type DataRequest = z.infer<typeof DataRequest>;

export const Comment = z.object({
  comment_id: z.string().uuid(),
  comment: z.string()
});
export type Comment = z.infer<typeof Comment>;

export const DataRequestStatus = z.object({
  data_request_status_id: z.string().uuid(),
  data_request_id: z.string().uuid(),
  comment_id: z.string().uuid().nullable(),
  request_status: DataRequestStatusEnum
});
export type DataRequestStatus = z.infer<typeof DataRequestStatus>;

export const DataRequestFilters = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  requested_by: z.number().int().optional(),
  team_id: z.string().optional(),
  status: DataRequestStatusEnum.optional()
});
export type DataRequestFilters = z.infer<typeof DataRequestFilters>;

export const DataRequestWithFilters = DataRequest.extend(DataRequestFilters.shape);

export const CreateDataRequest = z.object({
  reason: z.string()
});
export type CreateDataRequest = z.infer<typeof CreateDataRequest>;

export const UpdateDataRequest = z.object({
  reason: z.string().optional()
});
export type UpdateDataRequest = z.infer<typeof UpdateDataRequest>;

// ──────────────────────────────────────────────────────────────────────────────
// data_request CRUD Responses
// ──────────────────────────────────────────────────────────────────────────────

export const DataRequestWithStatus = DataRequest.extend({ data_request_status: DataRequestStatus });
export type DataRequestWithStatus = z.infer<typeof DataRequestWithStatus>;
