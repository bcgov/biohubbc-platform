import { z } from 'zod';

/**
 * Full api_key row as returned from the database.
 * `key_hash` is included for internal verification only.
 */
export const ApiKey = z.object({
  api_key_id: z.string().uuid(),
  system_user_id: z.number(),
  name: z.string(),
  key_prefix: z.string(),
  key_hash: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type ApiKey = z.infer<typeof ApiKey>;

/**
 * Public view of an api_key record.
 * Omits `key_hash`.
 */
export const ApiKeyView = ApiKey.omit({ key_hash: true });

export type ApiKeyView = z.infer<typeof ApiKeyView>;
