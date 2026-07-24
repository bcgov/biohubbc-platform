import { z } from 'zod';

/**
 * The two identities the search read paths can resolve.
 *
 * Feature search resolves a system user id that is either null or a number; it has no unfiltered
 * administrator branch. The map must show exactly what the table shows, so tile contexts mirror that
 * and deliberately offer no third class.
 */
export const MartinContextAccessClass = z.enum(['anon', 'scoped']);
export type MartinContextAccessClass = z.infer<typeof MartinContextAccessClass>;

/**
 * A tile context row: the server-side authorization state behind a map Martin session.
 */
export const MartinContext = z.object({
  martin_context_id: z.string().uuid(),
  context_hash: z.string(),
  access_class: MartinContextAccessClass,
  feature_type_id: z.number(),
  security_scope_ids: z.array(z.string().uuid()),
  expression_hash: z.string().nullable(),
  is_materialized: z.boolean(),
  expires_at: z.string(),
  create_date: z.string()
});
export type MartinContext = z.infer<typeof MartinContext>;

/** Fields supplied when creating a context; the rest are defaulted by the database. */
export const CreateMartinContext = MartinContext.omit({
  martin_context_id: true,
  expires_at: true,
  create_date: true
});
export type CreateMartinContext = z.infer<typeof CreateMartinContext>;

/** A context row plus the remaining lifetime the client needs in order to schedule a refresh. */
export const MartinContextWithExpiry = MartinContext.pick({
  martin_context_id: true,
  is_materialized: true
}).extend({
  expires_in_seconds: z.number()
});
export type MartinContextWithExpiry = z.infer<typeof MartinContextWithExpiry>;

/** Bounding box of a context's matched geometries, as [minx, miny, maxx, maxy] in WGS84. */
export const MartinContextBoundingBox = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type MartinContextBoundingBox = z.infer<typeof MartinContextBoundingBox>;
