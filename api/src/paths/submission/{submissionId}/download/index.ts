import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { DownloadService } from '../../../../services/download/download-service';
import { getApiBaseUrl } from '../../../../utils/api-url';
import { getLogger } from '../../../../utils/logger';
import { getActiveSystemUserId } from '../../../../utils/system-user-context';

const defaultLog = getLogger('paths/submission/{submissionId}/download');

export const POST: Operation = [createSubmissionDownload()];

POST.apiDoc = {
  description:
    'Create a download of every feature in a submission, named after the submission. Returns a download id and a URL the caller can poll for status.',
  tags: ['download'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'Submission ID.',
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    }
  ],
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
 * Create a download of every feature in one submission. Anonymous-capable: a missing bearer token is allowed.
 *
 * Mirrors `POST /api/download` with no expression, limited to the submission. Without a bearer token the request
 * runs on the shared API-user connection and `requestedBy` is null, so the export holds only unsecured features; an
 * authenticated request exports the features visible to that user. Visibility is re-evaluated when the export is
 * built.
 *
 * Delegates the orchestration to `DownloadService.createSubmissionDownloadRequest`. The route owns the connection
 * choice, the transaction boundary, and response shaping.
 *
 * @return {RequestHandler}
 */
export function createSubmissionDownload(): RequestHandler {
  return async (req, res) => {
    const submissionId = Number(req.params.submissionId);
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const requestedBy = isAuthenticated ? await getActiveSystemUserId(connection) : null;

      const downloadService = new DownloadService(connection);

      const { download_id } = await downloadService.createSubmissionDownloadRequest({ submissionId, requestedBy });

      await connection.commit();

      return res.status(201).json({
        download_id,
        download_url: `${getApiBaseUrl()}/api/download/${download_id}`
      });
    } catch (error) {
      defaultLog.error({ label: 'createSubmissionDownload', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
