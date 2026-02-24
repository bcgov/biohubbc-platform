import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { DownloadService } from '../../services/download/download-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/download');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'SystemUser' }]
  })),
  getDownloads()
];

GET.apiDoc = {
  description: "Get the current user's download requests",
  tags: ['download'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'List of download requests',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['downloads'],
            properties: {
              downloads: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['download_id', 'status'],
                  properties: {
                    download_id: {
                      type: 'string',
                      format: 'uuid'
                    },
                    status: {
                      type: 'string',
                      enum: ['pending', 'processing', 'ready', 'failed', 'downloaded']
                    },
                    started_at: {
                      type: 'string',
                      nullable: true
                    },
                    completed_at: {
                      type: 'string',
                      nullable: true
                    }
                  }
                }
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
 * Get the current user's download requests.
 *
 * Requires Bearer authentication. Anonymous downloads are accessed by their specific
 * download_id (UUID), not through this listing endpoint. Without a user identity there
 * is no way to scope "my downloads", so allowing unauthenticated access would return
 * every anonymous download in the system.
 */
export function getDownloads(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

      const downloadService = new DownloadService(connection);
      const downloads = await downloadService.getDownloadsByTeamMembership(systemUserId);

      await connection.commit();

      return res.status(200).json({ downloads });
    } catch (error) {
      defaultLog.error({ label: 'getDownloads', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
