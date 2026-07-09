import { z } from 'zod';
import { DownloadDetailRecord } from './download';

/**
 * HTTP request body for adding a download to a gallery.
 *
 * The OpenAPI request schema validates this shape at the route boundary.
 *
 * `downloadId` is the camelCase request field for the download's uuid. `sort` is
 * nullable: NULL sorts last in the gallery ordering, so a member added without
 * an explicit position lands at the end.
 *
 * Lives in its own `gallery-download` model file (alongside `models/gallery.ts`)
 * so the gallery-table types and the gallery↔download join types stay separable.
 */
export interface AddGalleryDownloadRequestBody {
  downloadId: string;
  sort?: number | null;
}

/**
 * Landing-tile read shape: a gallery download detail row plus the latest
 * version's stored feature count. `feature_count` must stay `.nullable()` —
 * versions materialized before counting existed carry NULL, and one stale row
 * must not fail the whole list parse.
 */
export const GalleryDownloadTileRecord = DownloadDetailRecord.extend({
  feature_count: z.number().nullable()
});
export type GalleryDownloadTileRecord = z.infer<typeof GalleryDownloadTileRecord>;
