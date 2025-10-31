import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../../services/submission-service';
import { getLogger } from '../../../../../utils/logger';
import { getReviewedSubmissionsForAdmins } from '../../../../administrative/submission/reviewed';

const defaultLog = getLogger('paths/submission/{submissionId}/features/{submissionFeatureId}');

export const GET: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          submissionFeatureId: Number(req.params.submissionFeatureId),
          discriminator: 'AccessPolicy'
        }
      ]
    };
  }),
  getReviewedSubmissionsForAdmins()
];

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
 * Retrieves a submission feature by its ID
 *
 * @returns {RequestHandler}
 */
export function getSubmissionFeatureById(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const submissionFeatureId = Number(req.params.submissionFeatureId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const feature = await submissionService.getSubmissionFeatureById(submissionFeatureId);

      await connection.commit();

      res.status(200).json(feature);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatureById', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
