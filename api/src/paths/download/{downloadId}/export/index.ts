import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import {
  CreateDownloadExportRequestSchema,
  DownloadExportListResponseSchema,
  DownloadExportResponseSchema
} from '../../../../openapi/schemas/download-export';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { publishProcessDownloadExportJob } from '../../../../queue/publisher';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DownloadExportService } from '../../../../services/download/download-export-service';
import { DownloadService } from '../../../../services/download/download-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}/export');

export const POST: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  createDownloadExport()
];

export const GET: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  listDownloadExports()
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
        schema: CreateDownloadExportRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Export created and queued for processing',
      content: {
        'application/json': {
          schema: DownloadExportResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

GET.apiDoc = {
  description: 'List all exports for a download, newest first',
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
  responses: {
    200: {
      description: 'Array of export records, newest first',
      content: {
        'application/json': {
          schema: DownloadExportListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a CSV export and publish the processing job inside a single
 * transaction. The `db` option on `publishProcessDownloadExportJob` ties the
 * job insert to the same transaction as the `download_export` row, so the
 * insert and the job enqueue succeed or fail together — no ghost jobs (job
 * present but row rolled back) and no orphaned exports (row committed but job
 * never sent).
 *
 * Client bounds on `max_part_size_bytes` are enforced by the OpenAPI body schema
 * (min 5 MiB, max 5 GiB → 400). The JSON body is an integer for client
 * ergonomics; widened to string here before hitting the service, because the
 * model stores `max_part_size_bytes` as `bigint` → `z.string()`.
 */
export function createDownloadExport(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const downloadId = req.params.downloadId;
      const body = req.body as { max_part_size_bytes?: number };

      const exportService = new DownloadExportService(connection);

      const exportRecord = await exportService.createDownloadExport(downloadId, systemUserId, {
        max_part_size_bytes: typeof body.max_part_size_bytes === 'number' ? String(body.max_part_size_bytes) : undefined
      });

      await publishProcessDownloadExportJob(connection, {
        downloadExportId: exportRecord.download_export_id
      });

      await connection.commit();

      return res.status(200).json(exportRecord);
    } catch (error) {
      defaultLog.error({ label: 'createDownloadExport', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * List all exports for a download.
 *
 * Authorizes against the parent download (same team-membership rule as every
 * other download-scoped endpoint) and returns the full list sorted newest
 * first. `part_count` is pre-joined at the repo layer so the card can decide
 * single-vs-multi-part UI without a per-row detail fetch.
 */
export function listDownloadExports(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const downloadId = req.params.downloadId;

      // Authorize the parent download before returning any export rows.
      await new DownloadService(connection).getAuthorizedDownload(downloadId, systemUserId);

      const exportService = new DownloadExportService(connection);
      const exports = await exportService.listExportsByDownloadId(downloadId);

      await connection.commit();

      return res.status(200).json(exports);
    } catch (error) {
      defaultLog.error({ label: 'listDownloadExports', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
