import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../../database/db';
import { DownloadFeatureTypesResponseSchema } from '../../../../../../openapi/schemas/download-version-export';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { DownloadExportService } from '../../../../../../services/download/download-export-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}/version/{downloadVersionId}/feature-types');

export const GET: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  getDownloadVersionFeatureTypes()
];

GET.apiDoc = {
  description: 'List the feature types and exportable columns for a download version',
  tags: ['download'],
  security: [{ Bearer: [] }],
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
      description: 'Feature types and exportable columns for the selected version',
      content: { 'application/json': { schema: DownloadFeatureTypesResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List the feature types and exportable columns for a specific download version.
 *
 * @return {RequestHandler} Express handler returning the selected version's exportable feature types.
 */
export function getDownloadVersionFeatureTypes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const exportService = new DownloadExportService(connection);
      const featureTypes = await exportService.getDownloadVersionExportFeatureTypes(
        req.params.downloadId,
        connection.systemUserId(),
        req.params.downloadVersionId
      );
      await connection.commit();
      return res.status(200).json(featureTypes);
    } catch (error) {
      defaultLog.error({ label: 'getDownloadVersionFeatureTypes', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
