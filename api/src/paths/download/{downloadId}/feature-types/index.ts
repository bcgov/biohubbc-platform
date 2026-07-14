import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { DownloadFeatureTypesResponseSchema } from '../../../../openapi/schemas/download-version-export';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DownloadExportService } from '../../../../services/download/download-export-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}/feature-types');

export const GET: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  getDownloadFeatureTypes()
];

GET.apiDoc = {
  description: 'List the feature types and exportable columns for a download',
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
      description: 'Array of feature types, each with the exact columns the export can produce',
      content: {
        'application/json': {
          schema: DownloadFeatureTypesResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * List, for a download's current materialized version, every feature type and the exact set of
 * columns the CSV pipeline can emit for it.
 *
 * This endpoint exists so the export-recipe picker only offers columns the export can actually
 * produce: the client builds a recipe by choosing among precisely these types and columns, and the
 * service returns the structural columns plus schema-derived headers — the same set the per-type CSV
 * writer emits. Without it the picker would have to guess at the materialized column set and could
 * surface columns the CSV never carries.
 *
 * Authorizes against the parent download (the same team-membership rule as every other
 * download-scoped endpoint).
 */
export function getDownloadFeatureTypes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const downloadId = req.params.downloadId;

      const exportService = new DownloadExportService(connection);
      const featureTypes = await exportService.getDownloadVersionExportFeatureTypes(downloadId, systemUserId);

      await connection.commit();

      return res.status(200).json(featureTypes);
    } catch (error) {
      defaultLog.error({ label: 'getDownloadFeatureTypes', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
