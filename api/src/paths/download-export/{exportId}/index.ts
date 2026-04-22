import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { DownloadStatusEnum } from '../../../models/download-status';
import { DownloadExportDetailResponseSchema } from '../../../openapi/schemas/download-export';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { DownloadExportService } from '../../../services/download/download-export-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/download-export/{exportId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  getDownloadExportDetail()
];

GET.apiDoc = {
  description: 'Get a download export by ID, including presigned part URLs when ready',
  tags: ['download'],
  security: [{ Bearer: [] }],
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
      description: 'Download export detail',
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
 * Get a download export by ID.
 *
 * `parts[]` is populated only when `status === 'ready'`. Non-ready statuses
 * (pending / processing / failed / downloaded) return an empty array so
 * clients don't accidentally attempt to download from URLs for incomplete
 * jobs. Presigned URLs are regenerated per request (expiry matches fragment
 * URLs) so clients should not cache them.
 */
export function getDownloadExportDetail(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const exportId = req.params.exportId;

      const exportService = new DownloadExportService(connection);
      const exportRecord = await exportService.getAuthorizedExport(exportId, systemUserId);

      const parts =
        exportRecord.status === DownloadStatusEnum.READY ? await exportService.listExportPartUrls(exportId) : [];

      await connection.commit();

      return res.status(200).json({
        ...exportRecord,
        parts
      });
    } catch (error) {
      defaultLog.error({ label: 'getDownloadExportDetail', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
