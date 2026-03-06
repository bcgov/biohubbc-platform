import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { GetSubmissionFeatureSchema } from '../../../../../schemas/submission-feature';
import { SubmissionService } from '../../../../../services/submission-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}/features/{submissionFeatureId}');

export const GET: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Team',
          entity: 'submission_feature',
          submissionFeatureId: Number(req.params.submissionFeatureId),
          submissionId: Number(req.params.submissionId)
        }
      ]
    };
  }),
  getSubmissionFeatureById()
];

GET.apiDoc = {
  description: 'Retrieves a specific submission feature',
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
      description: 'The requested submission feature',
      content: {
        'application/json': {
          schema: GetSubmissionFeatureSchema
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
    const connection = getDBConnection(req.keycloak_token);

    const submissionFeatureId = Number(req.params.submissionFeatureId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const [feature, relatedFeatures] = await Promise.all([
        submissionService.getSubmissionFeatureById(submissionFeatureId),
        submissionService.getRelatedSubmissionFeatures(submissionFeatureId)
      ]);

      await connection.commit();

      return res.status(200).json({ feature, relatedFeatures });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatureById', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
