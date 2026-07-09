import { GalleryDownloadTileRecord } from '../models/gallery-download';
import { createMockDownloadRecord } from './download';

/**
 * Test factory: build a GalleryDownloadTileRecord (a download detail row plus the
 * latest version's stored `feature_count`). Defaults to a counted version; tests
 * exercising the pre-counting NULL contract override `feature_count: null`.
 */
export const createMockGalleryDownloadTileRecord = (
  overrides?: Partial<GalleryDownloadTileRecord>
): GalleryDownloadTileRecord => ({
  ...createMockDownloadRecord(),
  feature_count: 9,
  ...overrides
});
