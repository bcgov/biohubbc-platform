import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../../database/db';
import { HTTP403, HTTP404, HTTP409 } from '../../../../../../errors/http-error';
import { DownloadStatusEnum } from '../../../../../../models/download-status';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { DownloadService } from '../../../../../../services/download-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}/fragment/{fragmentIndex}/url');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  getFragmentUrl()
];

GET.apiDoc = {
  description: 'Get a signed URL to download a specific fragment',
  tags: ['download'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'Download ID',
      in: 'path',
      name: 'downloadId',
      schema: {
        type: 'integer',
        minimum: 1
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
 * Verifies the requesting user owns the download and that the fragment is ready.
 *
 * @returns {RequestHandler}
 */
export function getFragmentUrl(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      const { system_user_id } = req.system_user;
      const downloadId = Number(req.params.downloadId);
      const fragmentIndex = Number(req.params.fragmentIndex);

      await connection.open();

      const downloadService = new DownloadService(connection);
      const download = await downloadService.findDownloadById(downloadId);

      if (!download) {
        throw new HTTP404('Download not found');
      }

      if (download.system_user_id !== system_user_id) {
        throw new HTTP403('Access denied');
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
