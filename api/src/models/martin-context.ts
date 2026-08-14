import { z } from 'zod';

/**
 * A tile context row: the server-side authorization state behind a map Martin session.
 *
 * A context references the persisted search expression (`expression_id`, NULL = unfiltered
 * browse-all) and the caller (`system_user_id`, NULL = anonymous). The tile function evaluates both
 * live at serve time; nothing about the result set is stored. Feature search resolves a system user
 * id that is either null or a number — it has no unfiltered administrator branch — and the map must
 * show exactly what the table shows, so tile contexts mirror that and deliberately offer no third
 * identity.
 */
export const MartinContext = z.object({
  martin_context_id: z.string().uuid(),
  context_hash: z.string(),
  expression_id: z.string().uuid().nullable(),
  feature_type_id: z.number(),
  system_user_id: z.number().nullable(),
  record_end_date: z.string(),
  create_date: z.string(),
  create_user: z.number()
});
export type MartinContext = z.infer<typeof MartinContext>;

/** Fields supplied when creating a context; the rest are defaulted or derived by the database. */
export const CreateMartinContext = MartinContext.omit({
  martin_context_id: true,
  record_end_date: true,
  create_date: true,
  create_user: true
});
export type CreateMartinContext = z.infer<typeof CreateMartinContext>;

/** A context row plus the remaining lifetime the client needs in order to schedule a refresh. */
export const MartinContextWithExpiry = MartinContext.pick({
  martin_context_id: true
}).extend({
  expires_in_seconds: z.number()
});
export type MartinContextWithExpiry = z.infer<typeof MartinContextWithExpiry>;
