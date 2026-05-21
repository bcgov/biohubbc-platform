import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { DownloadStatusEnum } from '../../../../models/download-status';
import { DownloadExportDetailResponseSchema } from '../../../../openapi/schemas/download-export';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DownloadExportService } from '../../../../services/download/download-export-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/script/download-export/{exportId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  getScriptDownloadExportDetail()
];

GET.apiDoc = {
  description:
    'Get a download export by ID for non-interactive scripts, including presigned part URLs when ready. Authenticated using an API key instead of a Bearer JWT.',
  tags: ['download'],
  security: [{ ApiKey: [] }],
  parameters: [
    {
      in: 'path',
      name: 'exportId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Download export UUID.'
    }
  ],
  responses: {
    200: {
      description: 'Download export detail.',
      content: {
        'application/json': {
          schema: DownloadExportDetailResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a download export by ID for non-interactive scripts.
 *
 * Mirrors the logic of `GET /api/download-export/{exportId}` but is authenticated via
 * `X-API-Key` header (ApiKey security scheme) instead of a Bearer JWT.
 *
 * Owner-scoping is enforced by `DownloadExportService.getAuthorizedExport`, which checks that
 * the export belongs to `systemUserId`. The system user is resolved from the synthetic keycloak
 * token written to `req.keycloak_token` by the API-key authentication handler.
 *
 * Presigned URLs are regenerated per request; clients must not cache them.
 */
export function getScriptDownloadExportDetail(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const exportId = req.params.exportId;

      const exportService = new DownloadExportService(connection);
      const exportRecord = await exportService.getAuthorizedExport(exportId, systemUserId);

      const parts =
        exportRecord.status === DownloadStatusEnum.READY
          ? await exportService.listExportPartUrls(exportId, exportRecord.started_at)
          : [];

      await connection.commit();

      return res.status(200).json({
        ...exportRecord,
        parts
      });
    } catch (error) {
      defaultLog.error({ label: 'getScriptDownloadExportDetail', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
