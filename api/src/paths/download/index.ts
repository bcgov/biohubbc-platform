import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { z } from 'zod';
import { getDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { ExpressionTree } from '../../models/expression-tree';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../openapi/schemas/pagination';
import { featureSearchExpressionTreeSchema } from '../../openapi/schemas/search/search-feature';
import { publishProcessDownloadJob } from '../../queue/publisher';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { ExpressionTreeService } from '../../services/expression-tree-service';
import { getApiBaseUrl } from '../../utils/api-url';
import { getLogger } from '../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../utils/pagination';

const defaultLog = getLogger('paths/download');

/**
 * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
 */
export const downloadPathDependencies = {
  getDBConnection,
  publishProcessDownloadJob
};

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'SystemUser' }]
  })),
  getDownloads()
];

GET.apiDoc = {
  description: "Get the current user's download requests with pagination",
  tags: ['download'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [...paginationRequestQueryParamSchema],
  responses: {
    200: {
      description: 'Paginated list of download requests',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['downloads', 'pagination'],
            properties: {
              downloads: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['download_id', 'download_status', 'create_date', 'exports'],
                  properties: {
                    download_id: {
                      type: 'string',
                      format: 'uuid'
                    },
                    download_status: {
                      type: 'string',
                      enum: ['pending', 'processing', 'ready', 'failed', 'downloaded']
                    },
                    create_date: {
                      type: 'string'
                    },
                    started_at: {
                      type: 'string',
                      nullable: true
                    },
                    completed_at: {
                      type: 'string',
                      nullable: true
                    },
                    exports: {
                      type: 'array',
                      description:
                        'Exports attached to this download, ordered by create_date DESC. Empty when no exports exist.',
                      items: {
                        type: 'object',
                        required: [
                          'download_export_id',
                          'download_id',
                          'format',
                          'status',
                          'mode',
                          'max_part_size_bytes',
                          'started_at',
                          'completed_at',
                          'error_message',
                          'part_count'
                        ],
                        properties: {
                          download_export_id: { type: 'string', format: 'uuid' },
                          download_id: { type: 'string', format: 'uuid' },
                          format: { type: 'string' },
                          status: {
                            type: 'string',
                            enum: ['pending', 'processing', 'ready', 'failed', 'downloaded']
                          },
                          mode: { type: 'string', enum: ['per_feature_type', 'denormalized'] },
                          max_part_size_bytes: { type: 'string' },
                          started_at: { type: 'string', nullable: true },
                          completed_at: { type: 'string', nullable: true },
                          error_message: { type: 'string', nullable: true },
                          part_count: { type: 'integer', minimum: 0 }
                        }
                      }
                    }
                  }
                }
              },
              pagination: paginationResponseSchema
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
    const connection = downloadPathDependencies.getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const pagination = makePaginationOptionsFromRequest(req);

      const downloadService = new DownloadService(connection);

      const { downloads, count } = await downloadService.getDownloadsByTeamMembership(systemUserId, pagination);

      await connection.commit();

      return res.status(200).json({ downloads, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getDownloads', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Request body for `POST /api/download`.
 *
 * `.strict()` rejects unknown keys to surface frontend decoder bugs (e.g. stale `ui_id`
 * leaking through) at the boundary instead of silently letting bad data flow into a
 * download policy.
 */
const CreateDownloadRequestBody = z
  .object({
    // 100 matches the underlying `biohub.policy.name varchar(100)` column. Keep both
    // in sync so a too-long name is rejected at the route boundary, not by a 500
    // from the DB layer.
    name: z.string().min(1).max(100),
    description: z.string().max(1000).nullable().optional(),
    featureTypes: z.array(z.string()).min(1),
    expression: ExpressionTree.nullable()
  })
  .strict();

export const POST: Operation = [
  authorizeRequestHandler(() => ({ and: [{ discriminator: 'SystemUser' }] })),
  createDownload()
];

POST.apiDoc = {
  description:
    'Create a download request from a name, target feature types, and an optional expression tree. Returns a download id and a URL the caller can poll for status.',
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
          type: 'object',
          additionalProperties: false,
          required: ['name', 'featureTypes', 'expression'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 1000, nullable: true },
            featureTypes: { type: 'array', items: { type: 'string' }, minItems: 1 },
            expression: { ...featureSearchExpressionTreeSchema, nullable: true }
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
            required: ['download_id', 'download_url'],
            properties: {
              download_id: {
                type: 'string',
                format: 'uuid'
              },
              download_url: {
                type: 'string',
                description: 'Fully-qualified API URL the caller can poll for status'
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
 * Create a download request.
 *
 * Persists the optional expression tree, creates the owning download policy, creates the
 * download record, links a fresh team to the download for the requesting user, and queues
 * the worker job — all inside one transaction so a mid-flow failure leaves no orphan rows.
 *
 * Authorization is enforced at export time, not create time. The user's authorization is
 * re-evaluated when the worker runs, using `download.create_user`. Snapshotting access at
 * create-time would let users export data they no longer have access to by simply queuing
 * a download earlier.
 *
 * Reject unknown request-body keys (Zod `.strict()`). Silent acceptance of unknown keys
 * masks frontend decoder bugs. Failing fast on `ui_id` and similar leakage points the FE
 * at its own bug rather than letting bad data flow into a policy.
 *
 * @return {RequestHandler}
 */
export function createDownload(): RequestHandler {
  return async (req, res) => {
    const parseResult = CreateDownloadRequestBody.safeParse(req.body);
    if (!parseResult.success) {
      throw new HTTP400('Invalid request body', parseResult.error.issues);
    }
    const { name, description, featureTypes, expression } = parseResult.data;

    const connection = downloadPathDependencies.getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

      const expressionTreeService = new ExpressionTreeService(connection);
      const downloadPolicyService = new DownloadPolicyService(connection);
      const downloadService = new DownloadService(connection);

      let expressionId: string | null = null;
      if (expression !== null) {
        const result = await expressionTreeService.writeExpressionTree(expression);
        expressionId = result.expression_id;
      }

      const { policy_id } = await downloadPolicyService.createDownloadPolicy({
        name,
        description: description ?? null,
        featureTypes,
        expressionId
      });

      const { download_id } = await downloadService.createDownload({ policyId: policy_id, format: 'parquet' });

      await downloadService.linkDownloadToNewTeam(
        download_id,
        systemUserId,
        `Team for download ${download_id}`,
        'Team automatically created for download'
      );

      await downloadPathDependencies.publishProcessDownloadJob(connection, { downloadId: download_id });

      await connection.commit();

      return res.status(201).json({
        download_id,
        download_url: `${getApiBaseUrl()}/api/download/${download_id}`
      });
    } catch (error) {
      defaultLog.error({ label: 'createDownload', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
