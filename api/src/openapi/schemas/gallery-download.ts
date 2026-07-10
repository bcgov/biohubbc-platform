import { OpenAPIV3 } from 'openapi-types';

/**
 * Request body schema for POST /gallery/{galleryId}/download — adds a download to a
 * gallery. `additionalProperties: false` rejects unknown keys at the boundary.
 *
 * Lives in its own `gallery-download` schema file (alongside `schemas/gallery.ts`)
 * so the gallery-table schemas and the gallery↔download join schemas stay
 * separable.
 */
export const AddGalleryDownloadRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['downloadId'],
  properties: {
    downloadId: { type: 'string', format: 'uuid', description: 'The download to add to the gallery.' },
    sort: {
      type: 'integer',
      nullable: true,
      description: 'Optional display order within the gallery. NULL sorts the record last.'
    }
  }
};

/**
 * A single gallery download row — the download detail row shape; exports are
 * fetched through the download/export endpoints when needed.
 */
export const GalleryDownloadResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'download_id',
    'download_version_id',
    'download_status',
    'format',
    'metadata',
    'started_at',
    'completed_at',
    'downloaded_at',
    'create_date',
    'name',
    'description'
  ],
  properties: {
    download_id: { type: 'string', format: 'uuid' },
    download_version_id: {
      type: 'string',
      format: 'uuid',
      description: 'The most-recent materialized version of this download.'
    },
    download_status: {
      type: 'string',
      enum: ['pending', 'processing', 'ready', 'failed', 'downloaded']
    },
    format: { type: 'string', description: 'Export wire format.' },
    metadata: { type: 'object', additionalProperties: true, nullable: true },
    started_at: { type: 'string', nullable: true },
    completed_at: { type: 'string', nullable: true },
    downloaded_at: { type: 'string', nullable: true },
    create_date: { type: 'string' },
    name: { type: 'string', description: "The owning policy's display name." },
    description: { type: 'string', nullable: true, description: "The owning policy's description." }
  }
};

/**
 * Response schema for GET /gallery/{galleryId}/download — gallery download
 * records.
 */
export const GalleryDownloadListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: GalleryDownloadResponseSchema
};

/**
 * Response schema for GET /gallery/slug/{slug}/download — landing-tile rows.
 * Extends the gallery download row with the latest version's stored
 * `feature_count` (null for versions materialized before counting existed).
 */
export const GalleryDownloadTileListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: {
    ...GalleryDownloadResponseSchema,
    required: [...(GalleryDownloadResponseSchema.required ?? []), 'feature_count'],
    properties: {
      ...GalleryDownloadResponseSchema.properties,
      feature_count: {
        type: 'integer',
        nullable: true,
        description:
          "Total features in the download's latest materialized version; null when materialized before counting existed."
      }
    }
  }
};
