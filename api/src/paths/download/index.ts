import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { DownloadService } from '../../services/download-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/download');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  createDownload()
];

POST.apiDoc = {
  description:
    'Create a download request. Request body TBD — will be shaped by cart checkout or query-based download ticket.',
  tags: ['download'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object'
        }
      }
    }
  },
  responses: {
    201: {
      description: 'Download request created successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['download_id', 'status'],
            properties: {
              download_id: {
                type: 'integer',
                minimum: 1
              },
              status: {
                type: 'string',
                enum: ['pending']
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
 * Create a download request and queue the processing job.
 *
 * TODO: Request body will be defined by whichever ticket lands first:
 * - Cart checkout: accepts a cart_id, resolves features from the cart
 * - Query-based bulk download: accepts query parameters, resolves features from a search
 *
 * Both flows end up calling DownloadService.createDownloadRequest() + publishProcessDownloadJob().
 *
 * @returns {RequestHandler}
 */
export function createDownload(): RequestHandler {
  return async (_req, res) => {
    return res.status(501).json({ message: 'Not implemented' });
  };
}

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
                      type: 'integer'
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

/**
 * Get all download requests for the current user.
 *
 * @returns {RequestHandler}
 */
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
