import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

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
 * Body schema for `POST /api/download/:downloadId/export` — the full export recipe plus the
 * optional `max_part_size_bytes` packaging knob.
 *
 * This schema enforces only the COARSE request shape (types present, fields well-formed, literals
 * pinned). The authoritative SEMANTIC validation — that the named feature types and columns
 * actually exist in the download's materialized version, that merge-step references resolve, and the
 * mode-structural rules (`per_feature_type` carries no `merge_steps`; `denormalized` requires a
 * `root_feature_type` drawn from `feature_types`) — lives in `validateExportConfig` in the service,
 * which throws a single error type. The recipe properties mirror `ExportConfig` (and its nested
 * `MergeStep` / `OutputColumn`) with snake_case wire names.
 *
 * `download_version_id` is required and names the materialized download version to export — it must
 * be a ready version belonging to this download.
 *
 * `max_part_size_bytes` is optional. When provided, the route layer enforces the 5 MiB–5 GiB bounds
 * via the integer min/max (out-of-range → 400). When omitted, the service applies the 500 MB
 * default.
 */
export const CreateDownloadVersionExportRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['download_version_id', 'version', 'export_type', 'mode', 'feature_types'],
  properties: {
    download_version_id: {
      type: 'string',
      format: 'uuid',
      description: 'The materialized download version to export. Must be a ready version belonging to this download.'
    },
    version: {
      type: 'integer',
      enum: [1],
      description: 'Recipe schema version. Pinned to 1 — the only version this release accepts.'
    },
    export_type: {
      type: 'string',
      enum: ['csv'],
      description: "Output format of the export. Always 'csv' in this release."
    },
    mode: {
      type: 'string',
      enum: ['per_feature_type', 'denormalized'],
      description:
        "Export shape. 'per_feature_type' writes one CSV per feature type; 'denormalized' joins feature types into a single CSV via merge_steps."
    },
    root_feature_type: {
      type: 'string',
      description:
        'Root feature type the denormalized merge chain starts from. Denormalized mode only; must be one of feature_types.'
    },
    feature_types: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      description: 'The feature types in scope for this export. Order carries no meaning — sorted at canonicalization.'
    },
    merge_steps: {
      type: 'array',
      default: [],
      description:
        'Ordered join steps for denormalized mode. Each step joins rows accumulated for left_feature_type to right_feature_type on left_column = right_column. Empty for per_feature_type mode.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['left_feature_type', 'left_column', 'right_feature_type', 'right_column'],
        properties: {
          left_feature_type: {
            type: 'string',
            description: 'Feature type whose accumulated rows are the left side of the join.'
          },
          left_column: { type: 'string', description: 'Column on the left feature type to join on.' },
          right_feature_type: { type: 'string', description: 'Feature type joined in on the right side.' },
          right_column: { type: 'string', description: 'Column on the right feature type to join on.' },
          merge_type: {
            type: 'string',
            enum: ['left'],
            description:
              "Join strategy. Defaults to 'left' (keeps every left row even with no right match); the only strategy this release."
          }
        }
      }
    },
    output_columns: {
      type: 'array',
      description:
        'Ordered columns for the denormalized CSV, each drawn from any feature type in scope. The array order is the CSV column order. Omit to let the service select all columns.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['feature_type', 'column'],
        properties: {
          feature_type: { type: 'string', description: 'Feature type the column is drawn from.' },
          column: { type: 'string', description: 'Column name on that feature type to include.' },
          output_column: {
            type: 'string',
            description: 'Header name for this column in the CSV. Defaults to {feature_type}_{column} when omitted.'
          }
        }
      }
    },
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
      enum: ['pending', 'processing', 'ready', 'failed']
    },
    mode: {
      type: 'string',
      enum: ['per_feature_type', 'denormalized'],
      description:
        "Export shape: 'per_feature_type' (one CSV per feature type) or 'denormalized' (a single joined CSV)."
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
  type: 'object',
  required: ['exports', 'pagination'],
  additionalProperties: false,
  properties: {
    exports: {
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
    },
    pagination: paginationResponseSchema
  }
};

export const DownloadVersionListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['versions', 'pagination'],
  additionalProperties: false,
  properties: {
    versions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['download_version_id', 'download_id', 'status', 'feature_count', 'create_date'],
        additionalProperties: false,
        properties: {
          download_version_id: { type: 'string', format: 'uuid' },
          download_id: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'ready', 'failed', 'downloaded']
          },
          feature_count: { type: 'integer', nullable: true },
          started_at: { type: 'string', nullable: true },
          completed_at: { type: 'string', nullable: true },
          materialized_at: { type: 'string', nullable: true },
          error_message: { type: 'string', nullable: true },
          create_date: { type: 'string' }
        }
      }
    },
    pagination: paginationResponseSchema
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
          chunk_id: { type: 'integer', description: '1-based part index.' },
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

/**
 * Response schema for `GET /api/download/:downloadId/feature-types`.
 *
 * Mirrors `DownloadExportFeatureType` (the model) and backs the export-recipe picker: each item is a
 * feature type the download's current materialized version can export, paired with the exact column
 * set the per-type CSV writer emits — the structural columns followed by the schema-derived headers.
 * Offering anything beyond this set would let a recipe reference a column the CSV never carries.
 */
export const DownloadFeatureTypesResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['feature_type', 'columns'],
    properties: {
      feature_type: { type: 'string', description: 'A feature type the current materialized version can export.' },
      columns: {
        type: 'array',
        items: { type: 'string' },
        description:
          'The exact columns the CSV pipeline emits for this feature type — structural columns plus schema-derived headers.'
      }
    }
  }
};
