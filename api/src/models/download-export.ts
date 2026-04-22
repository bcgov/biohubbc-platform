import { z } from 'zod';
import { DownloadStatusZod } from './download-status';

/**
 * Export shape discriminator.
 *
 * `per_feature_type` — one logical CSV per feature type (star shape). The only value
 * currently written; the `mode` column and CHECK constraint land now so a future
 * denormalized-mode addition is strictly additive (data, not schema, change).
 */
export const DownloadExportMode = z.enum(['per_feature_type', 'denormalized']);
export type DownloadExportMode = z.infer<typeof DownloadExportMode>;

export const DownloadExportRecord = z.object({
  download_export_id: z.string().uuid(),
  download_id: z.string(),
  format: z.string(),
  status: DownloadStatusZod,
  // BIGINT → string via pg default INT8 parser (matches DownloadRecord.fragment_size_bytes).
  max_part_size_bytes: z.string(),
  mode: DownloadExportMode,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  error_message: z.string().nullable()
});
export type DownloadExportRecord = z.infer<typeof DownloadExportRecord>;

export const DownloadExportId = DownloadExportRecord.pick({ download_export_id: true });
export type DownloadExportId = z.infer<typeof DownloadExportId>;

/**
 * HTTP body shape for `POST /api/download/:downloadId/export`.
 *
 * Only `max_part_size_bytes` is accepted from the client (optional — defaulted at the
 * service layer). `mode` is deliberately NOT exposed; the service hard-codes
 * `per_feature_type` until a second shape ships.
 */
export const CreateDownloadExportRequest = DownloadExportRecord.pick({ max_part_size_bytes: true }).partial();
export type CreateDownloadExportRequest = z.infer<typeof CreateDownloadExportRequest>;

/**
 * Service-layer payload shape passed to `DownloadExportRepository.createDownloadExport`.
 *
 * Service applies the max-part-size default and hard-codes `format='csv'` + `mode='per_feature_type'`.
 * Literals pin the single-shape contract; a future change would widen `mode` to the full enum.
 */
export const CreateDownloadExportPayload = z.object({
  download_id: z.string().uuid(),
  format: z.literal('csv'),
  mode: z.literal('per_feature_type'),
  max_part_size_bytes: z.string()
});
export type CreateDownloadExportPayload = z.infer<typeof CreateDownloadExportPayload>;

/**
 * Row shape returned by the list endpoint. `part_count` is a LEFT JOIN COUNT on
 * `download_export_artifact` (derived at query time, never persisted) — lets the
 * card render single-vs-multi-part UI without a round-trip to the detail endpoint.
 */
export const DownloadExportListRow = DownloadExportRecord.extend({
  part_count: z.number().int().nonnegative()
});
export type DownloadExportListRow = z.infer<typeof DownloadExportListRow>;
