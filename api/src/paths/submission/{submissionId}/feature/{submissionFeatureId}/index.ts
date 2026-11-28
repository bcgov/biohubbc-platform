import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { GetSubmissionFeatureSchema } from '../../../../../schemas/submission-feature';
import { SubmissionFeatureService } from '../../../../../services/submission-feature-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}/feature/{submissionFeatureId}');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      {
        discriminator: 'Team',
        entity: 'submission',
        submissionId: Number(req.params.submissionId)
      },
      {
        discriminator: 'SubmissionFeatureGrant',
        submissionId: Number(req.params.submissionId),
        submissionFeatureId: Number(req.params.submissionFeatureId)
      }
    ]
  })),
  getSubmissionFeatureBySubmissionId()
];

GET.apiDoc = {
  description:
    "Retrieves one of the submission's features at any lifecycle stage (unreviewed, current or superseded). A superseded feature carries its successor_submission_feature_id. Available to active members of the submission's team whose team policy grants reach the feature, and to system administrators.",
  tags: ['submission'],
  security: [{ Bearer: [] }],
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
 * Retrieves one of the submission's features by its ID, at any lifecycle stage.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionFeatureBySubmissionId(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token!);

    const submissionId = Number(req.params.submissionId);
    const submissionFeatureId = Number(req.params.submissionFeatureId);

    try {
      await connection.open();

      const submissionFeatureService = new SubmissionFeatureService(connection);

      const feature = await submissionFeatureService.getSubmissionFeatureBySubmissionId(
        submissionId,
        submissionFeatureId
      );

      await connection.commit();

      return res.status(200).json({ feature });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatureBySubmissionId', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
