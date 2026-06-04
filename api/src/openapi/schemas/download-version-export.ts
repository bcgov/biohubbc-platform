import { OpenAPIV3 } from 'openapi-types';

/**
 * 5 MiB — S3 multipart upload minimum part size. Below this, a part-zip can't
 * upload as its own S3 object.
 */
const MIN_PART_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * 5 GiB — single-zip practical ceiling.
 */
const MAX_PART_SIZE_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Body schema for `POST /api/download/:downloadId/export`.
 *
 * `max_part_size_bytes` is optional. When provided, the route layer enforces
 * the 5 MiB–5 GiB bounds via the integer min/max (out-of-range → 400). When
 * omitted, the service applies the 500 MB default.
 */
export const CreateDownloadVersionExportRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    max_part_size_bytes: {
      type: 'integer',
      minimum: MIN_PART_SIZE_BYTES,
      maximum: MAX_PART_SIZE_BYTES,
      description:
        'Maximum size in bytes of each exported part-zip. The pipeline rolls to a new part once a part reaches this threshold. 5 MiB–5 GiB.'
    }
  }
};

/**
 * Response schema for a single download version export record (used by POST and
 * by list items). Detail endpoint extends this with `parts[]`.
 */
export const DownloadVersionExportResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'download_version_export_id',
    'download_id',
    'format',
    'status',
    'mode',
    'max_part_size_bytes',
    'started_at',
    'completed_at',
    'error_message'
  ],
  additionalProperties: false,
  properties: {
    download_version_export_id: { type: 'string', format: 'uuid' },
    download_id: { type: 'string', format: 'uuid' },
    format: { type: 'string', description: "Requested export format. Always 'csv' in this release." },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'ready', 'failed', 'downloaded']
    },
    mode: {
      type: 'string',
      enum: ['per_feature_type', 'denormalized'],
      description: "Export shape. Always 'per_feature_type' in this release."
    },
    max_part_size_bytes: { type: 'string', format: 'int64' },
    started_at: { type: 'string', nullable: true },
    completed_at: { type: 'string', nullable: true },
    error_message: { type: 'string', nullable: true }
  }
};

/**
 * Response schema for the list endpoint. Each item extends the base record
 * with `part_count` so the card can decide single-vs-multi-part UI without a
 * detail-endpoint round-trip.
 */
export const DownloadVersionExportListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: {
    type: 'object',
    required: [...(DownloadVersionExportResponseSchema.required ?? []), 'part_count'],
    additionalProperties: false,
    properties: {
      ...DownloadVersionExportResponseSchema.properties,
      part_count: { type: 'integer', minimum: 0 }
    }
  }
};

/**
 * Response schema for the detail endpoint. Adds `parts[]` populated only when
 * `status === 'ready'`; all other statuses return an empty array so clients
 * don't accidentally attempt to download from stale URLs.
 */
export const DownloadVersionExportDetailResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [...(DownloadVersionExportResponseSchema.required ?? []), 'parts'],
  additionalProperties: false,
  properties: {
    ...DownloadVersionExportResponseSchema.properties,
    parts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['chunk_id', 'file_size_bytes', 'url'],
        additionalProperties: false,
        properties: {
          chunk_id: { type: 'integer', nullable: true, description: '1-based part index.' },
          file_size_bytes: { type: 'string', format: 'int64' },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Signed S3 URL for the part-zip. Regenerated per request — do not cache.'
          }
        }
      }
    }
  }
};
