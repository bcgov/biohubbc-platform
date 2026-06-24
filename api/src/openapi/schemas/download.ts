import { OpenAPIV3 } from 'openapi-types';

/**
 * A single Parquet artifact entry in the presigned-URL endpoint's `parts[]` array.
 */
export const DownloadPresignedUrlPartSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['feature_type', 'url', 'expires_at'],
  additionalProperties: false,
  properties: {
    feature_type: {
      type: 'string',
      description: 'Feature type name for the Parquet file (parsed from the S3 object key).'
    },
    url: {
      type: 'string',
      format: 'uri',
      description: 'Presigned S3 URL for the Parquet artifact. Regenerated per request — do not cache.'
    },
    expires_at: {
      type: 'string',
      format: 'date-time',
      description: 'ISO timestamp when the presigned URL expires (30 minutes from request time).'
    }
  }
};

/**
 * Response schema for `GET /api/download/{downloadId}/presigned-url`.
 *
 * Returns one presigned URL per Parquet feature type when the download status
 * is `ready` or `downloaded`.
 */
export const DownloadPresignedUrlResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['download_id', 'status', 'parts'],
  additionalProperties: false,
  properties: {
    download_id: { type: 'string', format: 'uuid' },
    status: {
      type: 'string',
      enum: ['ready', 'downloaded'],
      description: 'Current download status. Only `ready` and `downloaded` downloads return presigned URLs.'
    },
    parts: {
      type: 'array',
      items: DownloadPresignedUrlPartSchema
    }
  }
};
