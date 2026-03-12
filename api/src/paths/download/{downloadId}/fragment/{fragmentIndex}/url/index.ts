import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../../database/db';
import { HTTP400, HTTP409 } from '../../../../../../errors/http-error';
import { DownloadStatusEnum } from '../../../../../../models/download-status';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { DownloadService } from '../../../../../../services/download/download-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}/fragment/{fragmentIndex}/url');

export const GET: Operation = [getFragmentUrl()];

GET.apiDoc = {
  description: 'Get a signed URL to download a specific fragment',
  tags: ['download'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'Download ID',
      in: 'path',
      name: 'downloadId',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true
    },
    {
      description: 'Fragment index (zero-based)',
      in: 'path',
      name: 'fragmentIndex',
      schema: {
        type: 'integer',
        minimum: 0
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Signed fragment download URL',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['url'],
            properties: {
              url: {
                type: 'string',
                format: 'uri'
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a signed URL for downloading a specific fragment of a completed download.
 *
 * Unauthenticated downloads (system_user_id is null) are accessible to anyone.
 * Authenticated downloads are restricted to the requesting user.
 *
 * @returns {RequestHandler}
 */
export function getFragmentUrl(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      const downloadId = req.params.downloadId;
      const fragmentIndex = Number(req.params.fragmentIndex);
      if (isNaN(fragmentIndex) || fragmentIndex < 0 || !Number.isInteger(fragmentIndex)) {
        throw new HTTP400('Invalid fragment index');
      }

      await connection.open();

      const downloadService = new DownloadService(connection);
      const systemUserId = isAuthenticated ? connection.systemUserId() : null;
      const download = await downloadService.getAuthorizedDownload(downloadId, systemUserId);

      if (download.download_status !== DownloadStatusEnum.READY) {
        throw new HTTP409('Download is not ready');
      }

      const url = await downloadService.getFragmentSignedUrl(downloadId, fragmentIndex);

      await connection.commit();

      return res.status(200).json({ url });
    } catch (error) {
      defaultLog.error({ label: 'getFragmentUrl', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
