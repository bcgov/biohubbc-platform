import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { DownloadVersionListResponseSchema } from '../../../../openapi/schemas/download-version-export';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DownloadService } from '../../../../services/download/download-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/download/{downloadId}/version');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Download', downloadId: req.params.downloadId }]
  })),
  listDownloadVersions()
];

GET.apiDoc = {
  description: 'List versions for a download, newest first',
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
      description: 'Paginated version records, newest first',
      content: {
        'application/json': {
          schema: DownloadVersionListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * List versions for a download after Download authorization middleware succeeds.
 */
export function listDownloadVersions(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const downloadId = req.params.downloadId;
      const pagination = makePaginationOptionsFromRequest(req);

      const downloadService = new DownloadService(connection);
      const [versions, count] = await Promise.all([
        downloadService.listDownloadVersions(downloadId, pagination),
        downloadService.listDownloadVersionsCount(downloadId)
      ]);

      await connection.commit();

      return res.status(200).json({ versions, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'listDownloadVersions', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
