import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { SubmissionService } from '../../../../../services/submission-service';
import { UserService } from '../../../../../services/user-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}/features/{submissionFeatureId}/signed-url');

export const GET: Operation = [getSubmissionFeatureSignedUrl()];

GET.apiDoc = {
  description: 'Retrieves a signed url of a submission feature',
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
    },
    {
      description: 'Submission Feature ID.',
      in: 'path',
      name: 'submissionFeatureId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    },
    {
      description: 'submission feature property key search query',
      in: 'query',
      name: 'key',
      required: true,
      schema: {
        type: 'string'
      }
    },
    {
      description: 'submission feature property value search query',
      in: 'query',
      name: 'value',
      required: true,
      schema: {
        type: 'string'
      }
    }
  ],
  responses: {
    200: {
      description: 'The signed url for a key of a submission feature',
      content: {
        'application/json': {
          schema: {
            type: 'string'
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Retrieves signed url of a submission feature key
 *
 * @returns {RequestHandler}
 */
export function getSubmissionFeatureSignedUrl(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const submissionFeatureId = Number(req.params.submissionFeatureId);

    const submissionFeatureDataKey = String(req.query.key);

    const submissionFeatureDataValue = String(req.query.value);

    try {
      await connection.open();

      const userService = new UserService(connection);
      const submissionService = new SubmissionService(connection);

      const isAdmin = await userService.isSystemUserAdmin();

      const signedUrl = await submissionService.getSubmissionFeatureSignedUrl({
        submissionFeatureId,
        submissionFeatureObj: { key: submissionFeatureDataKey, value: submissionFeatureDataValue },
        isAdmin
      });

      await connection.commit();

      res.status(200).json(signedUrl);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatureSignedUrl', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
