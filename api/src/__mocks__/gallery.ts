import { GalleryRecord } from '../models/gallery';

/**
 * Test factory: build a GalleryRecord with sensible defaults. Callers override
 * fields that matter for the specific test.
 *
 * Carries only the four fields the read queries project (`gallery_id`, `name`,
 * `description`, `create_date`) — `record_end_date` is intentionally absent since
 * every gallery read filters to active rows, so it never appears in the returned
 * shape.
 */
export const createMockGalleryRecord = (overrides?: Partial<GalleryRecord>): GalleryRecord => ({
  gallery_id: 1,
  name: 'Test gallery',
  description: null,
  create_date: '2026-01-01T00:00:00.000Z',
  ...overrides
});
