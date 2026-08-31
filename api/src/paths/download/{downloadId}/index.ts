import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { HTTP404 } from '../../../errors/http-error';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { DownloadService } from '../../../services/download/download-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [{ discriminator: 'Team', entity: 'download', downloadId: req.params.downloadId }]
  })),
  findDownloadById()
];

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
            required: ['download_id', 'download_version_id', 'status', 'name'],
            properties: {
              download_id: {
                type: 'string',
                format: 'uuid'
              },
              download_version_id: {
                type: 'string',
                format: 'uuid',
                description: 'The most-recent materialized version of this download.'
              },
              status: {
                type: 'string',
                enum: ['pending', 'processing', 'ready', 'failed', 'downloaded']
              },
              name: {
                type: 'string'
              },
              description: {
                type: 'string',
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
 * Authorization is handled by download-scoped Team middleware. Use the authenticated
 * connection when a bearer token is present, otherwise fall back to the API user for anonymous links.
 *
 * @returns {RequestHandler}
 */
export function findDownloadById(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const downloadService = new DownloadService(connection);
      const download = await downloadService.findDownloadById(req.params.downloadId);

      if (!download) {
        throw new HTTP404('Download not found');
      }

      await connection.commit();

      return res.status(200).json({
        download_id: download.download_id,
        download_version_id: download.download_version_id,
        status: download.download_status,
        name: download.name,
        description: download.description,
        started_at: download.started_at,
        completed_at: download.completed_at,
        downloaded_at: download.downloaded_at
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
 * Claiming creates a team, adds the user as a member, and links the team
 * to the download via download_team. This converts an anonymous download
 * (UUID-only credential) into a team-based download accessible through
 * the standard authorization path (download_team → team → team_member).
 *
 * @returns {RequestHandler}
 */
export function claimDownloadForCurrentUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const downloadId = req.params.downloadId;
      const systemUserId = connection.systemUserId();

      const downloadService = new DownloadService(connection);
      await downloadService.claimDownload(downloadId, systemUserId);

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
