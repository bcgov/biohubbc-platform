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
