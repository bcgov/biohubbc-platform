import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import * as publisher from '../../queue/publisher';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadService } from '../../services/download/download-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { ISearchFeaturesFilters } from '../../services/search-feature-service.interface';
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

export const POST: Operation = [createDownload()];

POST.apiDoc = {
  description:
    'Create a download from search filters. Resolves filters to feature IDs server-side and creates a download record.',
  tags: ['download'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['filters'],
          properties: {
            filters: {
              type: 'object',
              description: 'Search filters — same schema as POST /api/search/feature',
              properties: {
                keyword: { type: 'string' },
                feature_types: { type: 'array', items: { type: 'string' } },
                species: { type: 'array', items: { type: 'string' } },
                properties: { type: 'array', items: { type: 'object' } }
              }
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: 'Download created',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['download_id'],
            properties: {
              download_id: {
                type: 'string',
                format: 'uuid'
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
 * Create a download from search filters.
 *
 * Bulk download bypasses the shopping cart — search filters are resolved to feature IDs
 * server-side, then a download record is created with all matching features linked.
 * Original filters are stored in `download.search_filters` for traceability (ticket requirement).
 * Uses a dedicated column instead of `metadata` which gets overwritten by the pipeline.
 *
 * OptionalBearer: anonymous users get a download with system_user_id = null
 * (UUID is the credential). Authenticated users get it linked to their account.
 *
 * teamId is null: downloads from search are user-owned, not team-based.
 * Team-based downloads originate from data requests only.
 */
export function createDownload(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const filters: ISearchFeaturesFilters = req.body.filters;

      // Resolve filters to feature IDs via CTE intersection
      const searchFeatureService = new SearchFeatureService(connection);
      const submissionFeatureIds = await searchFeatureService.getSearchFeatureIds(filters);

      // Empty results → 400. Prevents orphan download records with zero features.
      // The download pipeline would fail on an empty feature set.
      if (submissionFeatureIds.length === 0) {
        throw new HTTP400('No features match the filter criteria');
      }

      // Anonymous downloads: system_user_id is null (UUID is the credential).
      // Matches the cart checkout pattern (cart/{cartId}/checkout/index.ts:98).
      const systemUserId = isAuthenticated ? connection.systemUserId() : null;

      // Create download with search filters stored for traceability.
      // teamId is null: downloads from search are user-owned, not team-based.
      const pipelineService = new DownloadPipelineService(connection);
      const downloadId = await pipelineService.createDownloadRequest({
        systemUserId,
        teamId: null,
        submissionFeatureIds,
        searchFilters: filters
      });

      // Publish async processing job within the transaction
      await publisher.publishProcessDownloadJob(connection, { downloadId: downloadId.download_id });

      await connection.commit();

      return res.status(201).json({ download_id: downloadId.download_id });
    } catch (error) {
      defaultLog.error({ label: 'createDownload', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
