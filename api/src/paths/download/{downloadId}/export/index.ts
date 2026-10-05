import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { DownloadVersionExportListResponseSchema } from '../../../../openapi/schemas/download-version-export';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DownloadExportService } from '../../../../services/download/download-export-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/download/{downloadId}/export');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Download', downloadId: req.params.downloadId }]
  })),
  listDownloadVersionExports()
];

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
 * List all exports for a download after Download authorization middleware succeeds.
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
