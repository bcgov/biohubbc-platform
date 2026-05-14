import { z } from 'zod';
import { ExpressionTree } from './expression-tree';
import { PolicyStatus } from './policy';

export const DataRequest = z.object({
  data_request_id: z.string().uuid(),
  reason: z.string(),
  team_id: z.string().uuid(),
  requested_by: z.number(),
  ticket_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  create_date: z.string(),
  // Status is derived from joined policy.status (not persisted on data_request).
  status: PolicyStatus
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
  system_user_ids: z.array(z.number().int()),
  featureTypes: z.array(z.string()).min(1).optional(),
  expression: ExpressionTree.nullable().optional()
});
export type CreateDataRequestPayload = z.infer<typeof CreateDataRequestPayload>;

/**
 * Request-body shape for `POST /api/data-request`. Omits `requested_by` so the route
 * authoritatively injects it from `connection.systemUserId()` rather than trusting the
 * client. `.strict()` rejects unknown keys — including a stray `expression.ui_id` from
 * the frontend — so decoder bugs fail fast at the boundary instead of flowing into a
 * persisted policy / expression tree. `reason` is tightened to `min(1)` so the route
 * rejects an empty string at the boundary instead of letting it through to the
 * ticket-subject helper.
 */
export const CreateDataRequestRequestBody = CreateDataRequestPayload.omit({ requested_by: true })
  .extend({ reason: z.string().min(1) })
  .strict();
export type CreateDataRequestRequestBody = z.infer<typeof CreateDataRequestRequestBody>;

export const UpdateDataRequest = z.object({
  reason: z.string().optional()
});
export type UpdateDataRequest = z.infer<typeof UpdateDataRequest>;
