import { z } from 'zod';

export const SystemUser = z.object({
  system_user_id: z.number(),
  user_identity_source_id: z.number(),
  user_identifier: z.string(),
  user_guid: z.string(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number(),
  display_name: z.string().nullable(),
  given_name: z.string().nullable(),
  family_name: z.string().nullable(),
  email: z.string().nullable(),
  agency: z.string().nullable(),
  notes: z.string().nullable()
});

export type SystemUser = z.infer<typeof SystemUser>;

export const SystemUserExtended = SystemUser.extend({
  identity_source: z.string(),
  role_ids: z.array(z.number()),
  role_names: z.array(z.string())
});

export type SystemUserExtended = z.infer<typeof SystemUserExtended>;
