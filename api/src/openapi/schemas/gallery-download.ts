import { OpenAPIV3 } from 'openapi-types';
import { DownloadVersionExportListResponseSchema } from './download-version-export';

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
      description: 'Optional display order within the gallery. NULL sorts the member last.'
    }
  }
};

/**
 * Response schema for GET /gallery/{galleryId}/download — a gallery's download
 * members, each with its `exports[]` attached. Each item matches the download list
 * element shape (`DownloadDetailRecord` fields + the per-download `exports[]`), so
 * the gallery contents response is interchangeable with the download list element.
 */
export const GalleryDownloadListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: {
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
      'description',
      'exports'
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
      description: { type: 'string', nullable: true, description: "The owning policy's description." },
      exports: {
        ...DownloadVersionExportListResponseSchema,
        description: 'Exports attached to this download, ordered by create_date DESC. Empty when no exports exist.'
      }
    }
  }
};
