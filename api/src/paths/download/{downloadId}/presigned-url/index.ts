import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { HTTP404, HTTP409 } from '../../../../errors/http-error';
import { DownloadStatusEnum } from '../../../../models/download-status';
import { DownloadPresignedUrlResponseSchema } from '../../../../openapi/schemas/download';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DownloadService } from '../../../../services/download/download-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}/presigned-url');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      { discriminator: 'SystemUser' },
      { discriminator: 'Team', entity: 'download', downloadId: req.params.downloadId }
    ]
  })),
  getDownloadPresignedUrl()
];

GET.apiDoc = {
  description:
    'Generate presigned S3 URLs for the Parquet artifacts of a completed download. Authenticated via an API key. URLs expire after 30 minutes.',
  tags: ['download'],
  security: [{ ApiKey: [] }],
  parameters: [
    {
      in: 'path',
      name: 'downloadId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'UUID of the download to fetch presigned URLs for.'
    }
  ],
  responses: {
    200: {
      description: 'Presigned URLs for all Parquet artifacts of the download.',
      content: {
        'application/json': {
          schema: DownloadPresignedUrlResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Generate presigned S3 URLs for the Parquet artifacts of a download.
 *
 * Authorization is handled by one `authorizeRequestHandler` call combining `SystemUser`
 * and download-scoped `Team` discriminators. The API key authenticates the caller; the
 * team check still enforces the parent download's team-membership rule.
 *
 * Only `ready` and `downloaded` downloads may return URLs; any other status
 * produces a 409 Conflict so scripts can distinguish "not ready yet" from
 * access errors.
 *
 * @returns {RequestHandler}
 */
export function getDownloadPresignedUrl(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const { downloadId } = req.params;

      const downloadService = new DownloadService(connection);

      const download = await downloadService.findDownloadById(downloadId);
      if (!download) {
        throw new HTTP404('Download not found');
      }

      const readyStatuses: string[] = [DownloadStatusEnum.READY, DownloadStatusEnum.DOWNLOADED];
      if (!readyStatuses.includes(download.download_status)) {
        throw new HTTP409(
          'Download is not ready — presigned URLs are only available for ready or downloaded downloads'
        );
      }

      const parts = await downloadService.listDownloadParquetUrls(downloadId, download.download_version_id);

      await connection.commit();

      return res.status(200).json({
        download_id: download.download_id,
        status: download.download_status,
        parts
      });
    } catch (error) {
      defaultLog.error({ label: 'getDownloadPresignedUrl', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
