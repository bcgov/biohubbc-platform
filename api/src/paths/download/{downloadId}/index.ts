import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { HTTP403, HTTP404 } from '../../../errors/http-error';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { DownloadService } from '../../../services/download-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}');

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
  findDownloadById()
];

GET.apiDoc = {
  description: 'Get a download request by ID',
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
    }
  ],
  responses: {
    200: {
      description: 'Download request details',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['download_id', 'status', 'total_fragments', 'completed_fragments'],
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
              total_fragments: {
                type: 'integer'
              },
              completed_fragments: {
                type: 'integer'
              },
              estimated_total_size_bytes: {
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
              },
              downloaded_at: {
                type: 'string',
                nullable: true
              },
              fragments: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['fragment_index', 'status', 'feature_count'],
                  properties: {
                    fragment_index: {
                      type: 'integer'
                    },
                    status: {
                      type: 'string',
                      enum: ['pending', 'processing', 'ready', 'failed']
                    },
                    file_name: {
                      type: 'string',
                      nullable: true
                    },
                    file_size_bytes: {
                      type: 'integer',
                      nullable: true
                    },
                    estimated_size_bytes: {
                      type: 'integer',
                      nullable: true
                    },
                    feature_count: {
                      type: 'integer'
                    },
                    started_at: {
                      type: 'string',
                      nullable: true
                    },
                    completed_at: {
                      type: 'string',
                      nullable: true
                    },
                    error_message: {
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
 * Get a download request by ID.
 *
 * Verifies the requesting user owns the download.
 *
 * @returns {RequestHandler}
 */
export function findDownloadById(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      const { system_user_id } = req.system_user;
      const downloadId = Number(req.params.downloadId);

      await connection.open();

      const downloadService = new DownloadService(connection);
      const download = await downloadService.findDownloadById(downloadId);

      if (!download) {
        throw new HTTP404('Download not found');
      }

      if (download.system_user_id !== system_user_id) {
        throw new HTTP403('Access denied');
      }

      // Query fragments before commit (all DB calls inside transaction)
      const fragments = await downloadService.getFragmentsByDownloadId(downloadId);

      await connection.commit();

      return res.status(200).json({
        download_id: download.download_id,
        status: download.download_status,
        file_name: download.file_name,
        file_size_bytes: download.file_size_bytes,
        total_fragments: download.total_fragments,
        completed_fragments: download.completed_fragments,
        estimated_total_size_bytes: download.estimated_total_size_bytes,
        started_at: download.started_at,
        completed_at: download.completed_at,
        downloaded_at: download.downloaded_at,
        fragments: fragments.map((f) => ({
          fragment_index: f.fragment_index,
          status: f.fragment_status,
          file_name: f.file_name,
          file_size_bytes: f.file_size_bytes,
          estimated_size_bytes: f.estimated_size_bytes,
          feature_count: f.feature_count,
          started_at: f.started_at,
          completed_at: f.completed_at,
          error_message: f.error_message
        }))
      });
    } catch (error) {
      defaultLog.error({ label: 'findDownloadById', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
