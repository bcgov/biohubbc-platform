import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { CreateDownloadRequestBody } from '../../models/download';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../openapi/schemas/pagination';
import { featureSearchExpressionTreeSchema } from '../../openapi/schemas/search/search-feature';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { DownloadService } from '../../services/download/download-service';
import { getApiBaseUrl } from '../../utils/api-url';
import { getLogger } from '../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../utils/pagination';

const defaultLog = getLogger('paths/download');

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
    const connection = getDBConnection(req.keycloak_token);

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
 * Delegates the business orchestration (expression tree → policy → download → team link →
 * worker job) to `DownloadService.createDownloadRequest`. The route owns request parsing,
 * the transaction boundary, and response shaping.
 *
 * The requesting user's id is passed as `requestedBy` — the security identity the export is
 * built with and persisted to `download.requested_by`. Authorization is enforced at export
 * time, not create time: the worker re-evaluates visibility against `requested_by`, so a user
 * cannot export data they no longer have access to by queuing a download earlier.
 *
 * @return {RequestHandler}
 */
export function createDownload(): RequestHandler {
  return async (req, res) => {
    // Validate with Zod rather than relying on the openapi schema. The expression tree is
    // a recursive discriminated union which openapi cannot fully express; Zod also rejects
    // unknown keys via `.strict()` so a stray `ui_id` from the frontend fails fast at the
    // boundary instead of flowing into a policy. Do not delete this in favour of openapi.
    const parseResult = CreateDownloadRequestBody.safeParse(req.body);
    if (!parseResult.success) {
      throw new HTTP400('Invalid request body', parseResult.error.issues);
    }
    const { name, description, featureTypes, expression } = parseResult.data;

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const downloadService = new DownloadService(connection);

      const { download_id } = await downloadService.createDownloadRequest({
        name,
        description: description ?? null,
        featureTypes,
        expression,
        requestedBy: connection.systemUserId()
      });

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
