import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────────────
// request_status enum
// ──────────────────────────────────────────────────────────────────────────────

export const DataRequestStatusEnum = z.enum(['REQUESTED', 'APPROVED', 'DENIED']);
export type DataRequestStatusEnum = z.infer<typeof DataRequestStatusEnum>;

// ──────────────────────────────────────────────────────────────────────────────
// data_request table
// ──────────────────────────────────────────────────────────────────────────────

export const DataRequest = z.object({
  data_request_id: z.string().uuid(),
  reason: z.string(),
  team_id: z.string().uuid(),
  requested_by: z.number(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});
export type DataRequest = z.infer<typeof DataRequest>;

// ──────────────────────────────────────────────────────────────────────────────
// comment table
// ──────────────────────────────────────────────────────────────────────────────

export const Comment = z.object({
  comment_id: z.string().uuid(),
  comment: z.string(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});
export type Comment = z.infer<typeof Comment>;

// ──────────────────────────────────────────────────────────────────────────────
// data_request_status table
// ──────────────────────────────────────────────────────────────────────────────

export const DataRequestStatus = z.object({
  data_request_status_id: z.string().uuid(),
  data_request_id: z.string().uuid(),
  comment_id: z.string().uuid().nullable(),
  request_status: DataRequestStatusEnum,
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});
export type DataRequestStatus = z.infer<typeof DataRequestStatus>;

// ──────────────────────────────────────────────────────────────────────────────
// data_request CRUD Requests
// ──────────────────────────────────────────────────────────────────────────────

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

export const DataRequestWithStatus = z.object({
  data_request_id: z.string().uuid(),
  reason: z.string(),
  team_id: z.string().uuid(),
  requested_by: z.number(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number(),
  data_request_status: DataRequestStatus
});
export type DataRequestWithStatus = z.infer<typeof DataRequestWithStatus>;
