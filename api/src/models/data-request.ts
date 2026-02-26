import { z } from 'zod';
import { DataRequestStatus, DataRequestStatusEnum } from './data-request-status';

export const DataRequest = z.object({
  data_request_id: z.string().uuid(),
  reason: z.string(),
  team_id: z.string().uuid(),
  requested_by: z.number()
});
export type DataRequest = z.infer<typeof DataRequest>;

export const DataRequestFilters = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  requested_by: z.number().int().optional(),
  team_id: z.string().uuid().optional(),
  system_user_id: z.string().uuid().optional(),
  status: DataRequestStatusEnum.optional()
});
export type DataRequestFilters = z.infer<typeof DataRequestFilters>;

export const CreateDataRequest = z.object({
  reason: z.string(),
  team_id: z.string().uuid().optional()
});
export type CreateDataRequest = z.infer<typeof CreateDataRequest>;

export const UpdateDataRequest = z.object({
  reason: z.string().optional()
});
export type UpdateDataRequest = z.infer<typeof UpdateDataRequest>;

// ──────────────────────────────────────────────────────────────────────────────
// data_request CRUD Responses
// ──────────────────────────────────────────────────────────────────────────────

export const FlatDataRequestWithStatus = DataRequest.extend(DataRequestStatus.shape);
export type FlatDataRequestWithStatus = z.infer<typeof FlatDataRequestWithStatus>;

export const DataRequestWithStatus = DataRequest.extend({ data_request_status: DataRequestStatus });
export type DataRequestWithStatus = z.infer<typeof DataRequestWithStatus>;
