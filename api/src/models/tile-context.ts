import { z } from 'zod';

/**
 * The two identities the search read paths can resolve.
 *
 * Feature search resolves a system user id that is either null or a number; it has no unfiltered
 * administrator branch. The map must show exactly what the table shows, so tile contexts mirror that
 * and deliberately offer no third class.
 */
export const TileContextAccessClass = z.enum(['anon', 'scoped']);
export type TileContextAccessClass = z.infer<typeof TileContextAccessClass>;

/**
 * A tile context row: the server-side authorization state behind a map tile session.
 */
export const TileContext = z.object({
  tile_context_id: z.string().uuid(),
  context_hash: z.string(),
  access_class: TileContextAccessClass,
  feature_type_id: z.number(),
  security_scope_ids: z.array(z.string().uuid()),
  expression_hash: z.string().nullable(),
  is_materialized: z.boolean(),
  expires_at: z.string(),
  create_date: z.string()
});
export type TileContext = z.infer<typeof TileContext>;

/** Fields supplied when creating a context; the rest are defaulted by the database. */
export const CreateTileContext = TileContext.omit({
  tile_context_id: true,
  expires_at: true,
  create_date: true
});
export type CreateTileContext = z.infer<typeof CreateTileContext>;

/** A context row plus the remaining lifetime the client needs in order to schedule a refresh. */
export const TileContextWithExpiry = TileContext.pick({
  tile_context_id: true,
  is_materialized: true
}).extend({
  expires_in_seconds: z.number()
});
export type TileContextWithExpiry = z.infer<typeof TileContextWithExpiry>;

/** Bounding box of a context's matched geometries, as [minx, miny, maxx, maxy] in WGS84. */
export const TileContextBoundingBox = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type TileContextBoundingBox = z.infer<typeof TileContextBoundingBox>;
