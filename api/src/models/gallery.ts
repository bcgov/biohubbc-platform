import { z } from 'zod';
import { DownloadDetailRecord } from './download';
import { DownloadExportListRow } from './download-export';

/**
 * A curated collection of downloads, surfaced as a public-facing gallery.
 *
 * `record_end_date` soft-deletes a gallery (and scopes the name-uniqueness
 * constraint to active galleries only), but it is excluded from this returned
 * shape: every read query filters `WHERE record_end_date IS NULL`, so an active
 * row's `record_end_date` is always null and carrying it would be dead weight.
 *
 * `gallery_id` is a Postgres `integer` (→ JS number), unlike `download_id`
 * which is a uuid string.
 */
export const GalleryRecord = z.object({
  gallery_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  create_date: z.string()
});
export type GalleryRecord = z.infer<typeof GalleryRecord>;

/**
 * Service-layer payload passed to `GalleryRepository.createGallery` /
 * `updateGallery`. The optional `description` of the HTTP request body is
 * resolved to an explicit `string | null` before it reaches the repository, so
 * the write layer never has to decide what an absent field means.
 */
export const CreateGallery = z.object({
  name: z.string(),
  description: z.string().nullable()
});
export type CreateGallery = z.infer<typeof CreateGallery>;

/**
 * Display-ready gallery member: a `DownloadDetailRecord` (base download plus the
 * owning policy's `name`/`description`) with the download's `exports[]` attached.
 *
 * `exports[]` is composed at the service layer via a batch fetch and grouped by
 * download_id in JS — mirroring how `DownloadListRecord` is assembled — so the
 * repository stays single-SQL CRUD rather than reaching for SQL aggregation.
 *
 * Public-safe by inheritance: `DownloadDetailRecord` carries the curated
 * projection that omits `requested_by`, `policy_id`, and `create_user`, so no
 * security identity or audit field leaks through the gallery. `download_id`
 * stays a uuid string here (inherited from `DownloadDetailRecord`).
 */
export const GalleryDownloadListRecord = DownloadDetailRecord.extend({
  exports: z.array(DownloadExportListRow)
});
export type GalleryDownloadListRecord = z.infer<typeof GalleryDownloadListRecord>;

/**
 * HTTP request body for creating a gallery.
 *
 * `.strict()` rejects unknown keys: silently accepting stray fields would mask
 * frontend decoder bugs. Failing fast at the boundary points the FE at its own
 * bug rather than letting bad data flow into a gallery.
 */
export const CreateGalleryRequestBody = z
  .object({ name: z.string().min(1), description: z.string().nullable().optional() })
  .strict();
export type CreateGalleryRequestBody = z.infer<typeof CreateGalleryRequestBody>;

/**
 * HTTP request body for updating a gallery. Intentionally identical to
 * `CreateGalleryRequestBody` — the same fields (`name`, `description`) are the
 * only ones editable after creation.
 */
export const UpdateGalleryRequestBody = CreateGalleryRequestBody;
export type UpdateGalleryRequestBody = z.infer<typeof UpdateGalleryRequestBody>;

/**
 * HTTP request body for adding a download to a gallery.
 *
 * `.strict()` rejects unknown keys so a frontend decoder bug fails fast at the
 * boundary rather than leaking stray fields into the gallery membership.
 *
 * `downloadId` is the camelCase request field for the download's uuid. `sort` is
 * nullable: NULL sorts last in the gallery ordering, so a member added without
 * an explicit position lands at the end.
 */
export const AddGalleryDownloadRequestBody = z
  .object({ downloadId: z.string().uuid(), sort: z.number().int().nullable().optional() })
  .strict();
export type AddGalleryDownloadRequestBody = z.infer<typeof AddGalleryDownloadRequestBody>;
