import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { DownloadService } from '../../services/download-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/download');

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
                    file_name: {
                      type: 'string',
                      nullable: true
                    },
                    file_size_bytes: {
                      type: 'integer',
                      nullable: true
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

export function getDownloads(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      const { system_user_id } = req.system_user;

      await connection.open();

      const downloadService = new DownloadService(connection);
      const downloads = await downloadService.getDownloadsByUserId(system_user_id);

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
