import { z } from 'zod';

/**
 * A gallery's visibility on public (anonymous) reads.
 *
 * `public` galleries are returned by the anonymous read endpoints; `private`
 * galleries are filtered out of those reads (surfacing as a 404 so their
 * existence isn't leaked) and remain manageable only through the admin-gated
 * endpoints. Defaults to `public` when omitted on create.
 */
export const GalleryVisibility = z.enum(['public', 'private']);
export type GalleryVisibility = z.infer<typeof GalleryVisibility>;

/**
 * A curated collection of downloads, surfaced as a public-facing gallery.
 *
 * `record_end_date` soft-deletes a gallery (and scopes the slug-uniqueness
 * constraint to active galleries only), but it is excluded from this returned
 * shape: every read query filters `WHERE record_end_date IS NULL`, so an active
 * row's `record_end_date` is always null and carrying it would be dead weight.
 *
 * `slug` is the short, stable, URL-safe key consumers reference a gallery by; it
 * is unique among active galleries, unlike the mutable display `name`.
 *
 * `gallery_id` is a Postgres `integer` (→ JS number), unlike `download_id`
 * which is a uuid string.
 */
export const GalleryRecord = z.object({
  gallery_id: z.number(),
  name: z.string(),
  slug: z.string(),
  visibility: GalleryVisibility,
  description: z.string().nullable(),
  create_date: z.string()
});
export type GalleryRecord = z.infer<typeof GalleryRecord>;

/**
 * Service-layer payload passed to `GalleryRepository.createGallery` /
 * `updateGallery`. The optional `description`/`visibility` of the HTTP request
 * body are resolved to explicit values (`string | null`, and a `public` default)
 * before they reach the repository, so the write layer never has to decide what
 * an absent field means.
 */
export const CreateGallery = z.object({
  name: z.string(),
  slug: z.string(),
  visibility: GalleryVisibility,
  description: z.string().nullable()
});
export type CreateGallery = z.infer<typeof CreateGallery>;

/**
 * HTTP request body for creating a gallery.
 *
 * `.strict()` rejects unknown keys: silently accepting stray fields would mask
 * frontend decoder bugs. Failing fast at the boundary points the FE at its own
 * bug rather than letting bad data flow into a gallery.
 *
 * `slug` is required and must be a kebab-case URL key (lowercase alphanumerics
 * separated by single hyphens). `visibility` is optional and defaults to
 * `public` in the service.
 */
export const CreateGalleryRequestBody = z
  .object({
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case (lowercase alphanumerics separated by hyphens)'),
    visibility: GalleryVisibility.optional(),
    description: z.string().nullable().optional()
  })
  .strict();
export type CreateGalleryRequestBody = z.infer<typeof CreateGalleryRequestBody>;

/**
 * HTTP request body for updating a gallery. Intentionally identical to
 * `CreateGalleryRequestBody` — the same fields (`name`, `slug`, `visibility`,
 * `description`) are the only ones editable after creation.
 */
export const UpdateGalleryRequestBody = CreateGalleryRequestBody;
export type UpdateGalleryRequestBody = z.infer<typeof UpdateGalleryRequestBody>;
