import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../../database/db';
import { HTTP403, HTTP404, HTTP409 } from '../../../../../../errors/http-error';
import { DownloadStatusEnum } from '../../../../../../models/download-status';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { DownloadService } from '../../../../../../services/download-service';
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

      await connection.open();

      const downloadService = new DownloadService(connection);
      const download = await downloadService.findDownloadById(downloadId);

      if (!download) {
        throw new HTTP404('Download not found');
      }

      // Owned downloads can only be accessed by the user who created them
      if (download.system_user_id !== null) {
        const systemUserId = isAuthenticated ? connection.systemUserId() : null;

        if (download.system_user_id !== systemUserId) {
          throw new HTTP403('Access denied');
        }
      }

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
