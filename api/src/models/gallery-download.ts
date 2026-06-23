import { z } from 'zod';

/**
 * HTTP request body for adding a download to a gallery.
 *
 * `.strict()` rejects unknown keys so a frontend decoder bug fails fast at the
 * boundary rather than leaking stray fields into the gallery membership.
 *
 * `downloadId` is the camelCase request field for the download's uuid. `sort` is
 * nullable: NULL sorts last in the gallery ordering, so a member added without
 * an explicit position lands at the end.
 *
 * Lives in its own `gallery-download` model file (alongside `models/gallery.ts`)
 * so the gallery-table types and the gallery↔download join types stay separable.
 */
export const AddGalleryDownloadRequestBody = z
  .object({ downloadId: z.string().uuid(), sort: z.number().int().nullable().optional() })
  .strict();
export type AddGalleryDownloadRequestBody = z.infer<typeof AddGalleryDownloadRequestBody>;
