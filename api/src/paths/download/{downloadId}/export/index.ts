import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { CreateDownloadVersionExportRequest } from '../../../../models/download-version-export';
import {
  CreateDownloadVersionExportRequestSchema,
  DownloadVersionExportListResponseSchema,
  DownloadVersionExportResponseSchema
} from '../../../../openapi/schemas/download-version-export';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DownloadExportService } from '../../../../services/download/download-export-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/download/{downloadId}/export');

export const POST: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  createDownloadVersionExport()
];

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Team', entity: 'download', downloadId: req.params.downloadId }]
  })),
  listDownloadVersionExports()
];

POST.apiDoc = {
  description: 'Create a CSV export for a ready download',
  tags: ['download'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'downloadId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Download UUID.'
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: CreateDownloadVersionExportRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Export created and queued for processing',
      content: {
        'application/json': {
          schema: DownloadVersionExportResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

GET.apiDoc = {
  description: 'List all exports for a download, newest first',
  tags: ['download'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'downloadId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Download UUID.'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Paginated export records, newest first',
      content: {
        'application/json': {
          schema: DownloadVersionExportListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a CSV export and publish the processing job inside a single
 * transaction. The service validates the recipe against the download's materialized data,
 * resolves-or-creates the shared artifact group, inserts the per-user export row, and enqueues the
 * packaging job on this same `connection` — so the row insert and the job enqueue succeed or fail
 * together (no ghost jobs, no orphaned exports) and the job fires only for genuinely new work.
 *
 * The body is the full export recipe plus an optional `max_part_size_bytes` packaging knob; the
 * recipe is passed to the service, which parses, validates, canonicalizes, and hashes it. Structural
 * body shape is enforced by the OpenAPI schema at the transport boundary. `max_part_size_bytes`
 * arrives as an integer for client ergonomics and is widened to a string here because the model
 * stores it as `bigint` → `z.string()`.
 */
export function createDownloadVersionExport(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const downloadId = req.params.downloadId;
      // The request body is the full export recipe (ExportConfig) plus a required `download_version_id`
      // and an optional `max_part_size_bytes`. Spread it through verbatim — `download_version_id` and the
      // config fields ride along — only normalizing `max_part_size_bytes` (wire integer → BIGINT-as-string).
      const body = req.body as CreateDownloadVersionExportRequest & { max_part_size_bytes?: number };
      const request: CreateDownloadVersionExportRequest = {
        ...req.body,
        max_part_size_bytes: typeof body.max_part_size_bytes === 'number' ? String(body.max_part_size_bytes) : undefined
      };

      const exportService = new DownloadExportService(connection);

      const exportRecord = await exportService.createDownloadVersionExport(
        downloadId,
        systemUserId,
        request,
        connection
      );

      await connection.commit();

      return res.status(200).json(exportRecord);
    } catch (error) {
      defaultLog.error({ label: 'createDownloadVersionExport', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * List all exports for a download. Authorization is handled by download-scoped Team middleware.
 * `part_count` is pre-joined at the repo layer so the UI can decide single-vs-multi-part presentation
 * without a per-row detail fetch.
 */
export function listDownloadVersionExports(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const downloadId = req.params.downloadId;
      const pagination = makePaginationOptionsFromRequest(req);

      const exportService = new DownloadExportService(connection);
      const [exports, count] = await Promise.all([
        exportService.listDownloadVersionExports(downloadId, pagination),
        exportService.listDownloadVersionExportsCount(downloadId)
      ]);

      await connection.commit();

      return res.status(200).json({ exports, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'listDownloadVersionExports', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
