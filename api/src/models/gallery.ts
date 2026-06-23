import { z } from 'zod';

/**
 * A gallery's advertising/readiness state.
 *
 * Galleries are addressable when active regardless of this value. `private`
 * lets admins hide a gallery from advertised surfaces until it is ready.
 * Defaults to `public` when omitted on create.
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
export interface CreateGallery {
  name: string;
  slug: string;
  visibility: GalleryVisibility;
  description: string | null;
}

/**
 * HTTP request body for creating a gallery.
 *
 * The OpenAPI request schema validates this shape at the route boundary.
 * `visibility` is optional and defaults to `public` in the service.
 */
export interface CreateGalleryRequestBody {
  name: string;
  slug: string;
  visibility?: GalleryVisibility;
  description?: string | null;
}

/**
 * HTTP request body for updating a gallery. Intentionally identical to
 * `CreateGalleryRequestBody` — the same fields (`name`, `slug`, `visibility`,
 * `description`) are the only ones editable after creation.
 */
export type UpdateGalleryRequestBody = CreateGalleryRequestBody;
