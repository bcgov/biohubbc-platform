import { z } from 'zod';
import { PolicyStatus } from './policy';

export const DataRequest = z.object({
  data_request_id: z.string().uuid(),
  reason: z.string(),
  team_id: z.string().uuid(),
  requested_by: z.number(),
  ticket_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  // Derived from joined policy.status (not persisted on data_request).
  status: PolicyStatus,
  create_date: z.string().optional()
});
export type DataRequest = z.infer<typeof DataRequest>;

export const DataRequestFilters = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  requested_by: z.number().int().optional(),
  team_id: z.string().uuid().optional(),
  status: PolicyStatus.optional()
});
export type DataRequestFilters = z.infer<typeof DataRequestFilters>;

export const CreateDataRequest = z.object({
  requested_by: z.number().int(),
  reason: z.string(),
  ticket_id: z.string().uuid(),
  team_id: z.string().uuid(),
  policy_id: z.string().uuid()
});
export type CreateDataRequest = z.infer<typeof CreateDataRequest>;

export const CreateDataRequestPayload = z.object({
  requested_by: z.number().int(),
  reason: z.string(),
  ticket_id: z.string().uuid(),
  system_user_ids: z.array(z.number().int())
});
export type CreateDataRequestPayload = z.infer<typeof CreateDataRequestPayload>;

export const UpdateDataRequest = z.object({
  reason: z.string().optional()
});
export type UpdateDataRequest = z.infer<typeof UpdateDataRequest>;
