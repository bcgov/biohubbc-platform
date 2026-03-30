import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { SecurityService } from '../../../../../../services/security-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security/submission/{submissionId}');

export const PATCH: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  patchSecurityRulesOnSubmissionFeatures()
];

PATCH.apiDoc = {
  description: 'Applies security rules to a list of submission features.',
  tags: ['security'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Payload of submission features and rules to apply.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['submissionFeatureIds', 'applyRuleIds', 'removeRuleIds'],
          properties: {
            submissionFeatureIds: {
              type: 'array',
              items: {
                type: 'integer'
              },
              minItems: 1
            },
            applyRuleIds: {
              type: 'array',
              items: {
                type: 'integer'
              }
            },
            removeRuleIds: {
              type: 'array',
              items: {
                type: 'integer'
              }
            }
          }
        }
      }
    }
  },
  responses: {
    204: {
      description: 'Successfully applied and/or removed security rules.'
    },
    ...defaultErrorResponses
  }
};

export function patchSecurityRulesOnSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const service = new SecurityService(connection);

    const submissionId = Number(req.params.submissionId);
    const submissionFeatureIds: number[] = req.body.submissionFeatureIds;
    const applyRuleIds: number[] = req.body.applyRuleIds;
    const removeRuleIds: number[] = req.body.removeRuleIds;

    try {
      await connection.open();

      await service.patchSecurityRulesOnSubmissionFeatures(
        submissionId,
        submissionFeatureIds,
        applyRuleIds,
        removeRuleIds
      );

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'patchSecurityRulesOnSubmissionFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
