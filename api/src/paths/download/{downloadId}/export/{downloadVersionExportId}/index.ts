import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../database/db';
import { DownloadVersionExportDetailResponseSchema } from '../../../../../openapi/schemas/download-version-export';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { DownloadExportService } from '../../../../../services/download/download-export-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}/export/{downloadVersionExportId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  getDownloadVersionExportDetail()
];

GET.apiDoc = {
  description: 'Get a download export by ID, including presigned part URLs when ready',
  tags: ['download'],
  security: [{ Bearer: [] }],
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
      name: 'downloadVersionExportId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Download version export UUID.'
    }
  ],
  responses: {
    200: {
      description: 'Download export detail',
      content: {
        'application/json': {
          schema: DownloadVersionExportDetailResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a download export by ID under its parent download.
 *
 * `parts[]` is populated only when `status === 'ready'`. Non-ready statuses
 * (pending / processing / failed / downloaded) return an empty array so
 * clients don't accidentally attempt to download from URLs for incomplete
 * jobs. Presigned URLs are regenerated per request so clients should not
 * cache them.
 */
export function getDownloadVersionExportDetail(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const downloadId = req.params.downloadId;
      const exportId = req.params.downloadVersionExportId;

      const exportService = new DownloadExportService(connection);
      const result = await exportService.getAuthorizedExportWithParts(downloadId, exportId, systemUserId);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getDownloadVersionExportDetail', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
