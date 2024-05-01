import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { SubmissionService } from '../../../../../services/submission-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}/published/download');

export const GET: Operation = [downloadPublishedSubmission()];

GET.apiDoc = {
  description: 'Downloads a submission record and all associated features from the submission table',
  tags: ['submission'],
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
    200: {
      description: 'A submission record and all child submission feature records.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: ['submission_feature_id', 'parent_submission_feature_id', 'feature_type_name', 'data', 'level'],
              properties: {
                submission_feature_id: {
                  type: 'integer',
                  minimum: 1
                },
                parent_submission_feature_id: {
                  type: 'integer',
                  minimum: 1,
                  nullable: true
                },
                feature_type_name: {
                  type: 'string'
                },
                data: {
                  type: 'object'
                },
                level: {
                  type: 'integer',
                  minimum: 1
                }
              },
              additionalProperties: false
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Retrieves all child submission feature records.
 *
 * @returns {RequestHandler}
 */
export function downloadPublishedSubmission(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const result = await submissionService.downloadPublishedSubmission(submissionId);

      await connection.commit();

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'downloadPublishedSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
