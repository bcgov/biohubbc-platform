import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { DownloadStatusEnum } from '../../../models/download-status';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { DownloadPipelineService } from '../../../services/download/download-pipeline-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}');

export const GET: Operation = [findDownloadById()];

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'SystemUser' }]
  })),
  claimDownloadForCurrentUser()
];

PUT.apiDoc = {
  description: 'Claim an anonymous download for the current user',
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
        type: 'string',
        format: 'uuid'
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Download claimed successfully'
    },
    ...defaultErrorResponses
  }
};

GET.apiDoc = {
  description: 'Get a download request by ID',
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
                type: 'string',
                format: 'uuid'
              },
              status: {
                type: 'string',
                enum: ['pending', 'processing', 'ready', 'failed', 'downloaded']
              },
              total_fragments: {
                type: 'integer'
              },
              completed_fragments: {
                type: 'integer'
              },
              estimated_total_size_bytes: {
                type: 'string',
                format: 'int64',
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
                      type: 'string',
                      format: 'int64',
                      nullable: true
                    },
                    estimated_size_bytes: {
                      type: 'string',
                      format: 'int64',
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
                    },
                    url: {
                      type: 'string',
                      format: 'uri',
                      nullable: true,
                      description: 'Signed download URL. Included for anonymous users when fragment is ready.'
                    }
                  }
                }
              },
              instructions: {
                type: 'string',
                nullable: true,
                description: 'Download instructions for anonymous users when download is ready.'
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
 * Unauthenticated requests can access anonymous downloads (team_id IS NULL).
 * Authenticated requests can also access downloads they are authorized for.
 *
 * @returns {RequestHandler}
 */
export function findDownloadById(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      const downloadId = req.params.downloadId;

      await connection.open();

      const pipelineService = new DownloadPipelineService(connection);
      const systemUserId = isAuthenticated ? connection.systemUserId() : null;
      const download = await pipelineService.getAuthorizedDownload(downloadId, systemUserId);

      // Query fragments before commit (all DB calls inside transaction)
      const fragments = await pipelineService.getFragmentsByDownloadId(downloadId);

      // For anonymous users with a ready download, generate signed URLs inline
      // so they can download fragments without additional API calls.
      const isReady = download.download_status === DownloadStatusEnum.READY;
      const includeUrls = !isAuthenticated && isReady;

      const fragmentUrls: Map<number, string> = new Map();
      if (includeUrls) {
        for (const f of fragments) {
          if (f.fragment_status === DownloadStatusEnum.READY) {
            const url = await pipelineService.getFragmentSignedUrl(downloadId, f.fragment_index);
            fragmentUrls.set(f.fragment_index, url);
          }
        }
      }

      await connection.commit();

      const fragmentsResponse = fragments.map((f) => ({
        fragment_index: f.fragment_index,
        status: f.fragment_status,
        file_name: f.file_name,
        file_size_bytes: f.file_size_bytes,
        estimated_size_bytes: f.estimated_size_bytes,
        feature_count: f.feature_count,
        started_at: f.started_at,
        completed_at: f.completed_at,
        error_message: f.error_message,
        ...(fragmentUrls.has(f.fragment_index) && { url: fragmentUrls.get(f.fragment_index) })
      }));

      // Build instructions for anonymous users so they know how to retrieve their files.
      const instructions = includeUrls
        ? `Your download is ready. Each fragment URL below is a signed link valid for 5 days. ` +
          `Download with: curl -o <filename> "<url>"`
        : null;

      return res.status(200).json({
        download_id: download.download_id,
        status: download.download_status,
        total_fragments: download.total_fragments,
        completed_fragments: download.completed_fragments,
        estimated_total_size_bytes: download.estimated_total_size_bytes,
        started_at: download.started_at,
        completed_at: download.completed_at,
        downloaded_at: download.downloaded_at,
        fragments: fragmentsResponse,
        instructions
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

/**
 * Claim an anonymous download for the current authenticated user.
 *
 * @returns {RequestHandler}
 */
export function claimDownloadForCurrentUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const downloadId = req.params.downloadId;

      const pipelineService = new DownloadPipelineService(connection);
      await pipelineService.claimDownload(downloadId);

      await connection.commit();

      return res.sendStatus(200);
    } catch (error) {
      defaultLog.error({ label: 'claimDownloadForCurrentUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
