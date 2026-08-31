import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../database/db';
import { DownloadVersionResponseSchema } from '../../../../../openapi/schemas/download-version-export';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { DownloadService } from '../../../../../services/download/download-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}/version/{downloadVersionId}');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Team', entity: 'download', downloadId: req.params.downloadId }]
  })),
  getDownloadVersion()
];

GET.apiDoc = {
  description: 'Get one version of a download',
  tags: ['download'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'downloadId',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    },
    {
      in: 'path',
      name: 'downloadVersionId',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    }
  ],
  responses: {
    200: {
      description: 'Download version record',
      content: { 'application/json': { schema: DownloadVersionResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a single version belonging to the download identified by the route parameters.
 *
 * Authorization is handled by download-scoped Team middleware. Authenticated requests use the
 * caller's database connection; anonymous download links use the API-user connection.
 *
 * @return {RequestHandler} Express request handler that returns the requested download version.
 */
export function getDownloadVersion(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();
      const downloadService = new DownloadService(connection);
      const version = await downloadService.getDownloadVersion(req.params.downloadId, req.params.downloadVersionId);
      await connection.commit();
      return res.status(200).json(version);
    } catch (error) {
      defaultLog.error({ label: 'getDownloadVersion', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
