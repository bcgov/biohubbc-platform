import { z } from 'zod';

/**
 * Full access_key row as returned from the database.
 * `key_hash` is included here for internal verification; it must never be returned to API callers.
 */
export const AccessKey = z.object({
  access_key_id: z.string().uuid(),
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

export type AccessKey = z.infer<typeof AccessKey>;

/**
 * Public view of an access_key record.
 * Omits `key_hash` — the hash must never leave the API layer.
 */
export const AccessKeyView = AccessKey.omit({ key_hash: true });

export type AccessKeyView = z.infer<typeof AccessKeyView>;
