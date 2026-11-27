import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../../database/db';
import { DownloadVersionFeatureListResponseSchema } from '../../../../../../openapi/schemas/download-version-export';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { DownloadService } from '../../../../../../services/download/download-service';
import { getLogger } from '../../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../../utils/pagination';

const defaultLog = getLogger('paths/download/{downloadId}/version/{downloadVersionId}/features');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Download', downloadId: req.params.downloadId }]
  })),
  listDownloadVersionFeatures()
];

GET.apiDoc = {
  description: 'List the features of one version of a download, in ascending submission_feature_id',
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
    {
      in: 'path',
      name: 'downloadVersionId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Download version UUID.'
    },
    // The list has one fixed order, so only `page` and `limit` are accepted.
    ...paginationRequestQueryParamSchema.filter((parameter) => ['page', 'limit'].includes(parameter.name))
  ],
  responses: {
    200: {
      description: 'Paginated features of the download version',
      content: {
        'application/json': {
          schema: DownloadVersionFeatureListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * List the features of a download version after Download authorization middleware succeeds.
 *
 * The Download authorization rule grants UUID access to unclaimed downloads and linked-team access
 * to claimed downloads. Anonymous download links use the API-user connection.
 */
export function listDownloadVersionFeatures(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const pagination = makePaginationOptionsFromRequest(req);

      const downloadService = new DownloadService(connection);
      const { features, count, is_snapshot } = await downloadService.listDownloadVersionFeatures(
        req.params.downloadId,
        req.params.downloadVersionId,
        pagination
      );

      await connection.commit();

      return res.status(200).json({ features, is_snapshot, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'listDownloadVersionFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
