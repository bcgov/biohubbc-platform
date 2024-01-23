import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SecurityService } from '../../../../services/security-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security/submission/{submissionId}');

export const GET: Operation = [
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
  getAllSecurityRulesForSubmissionFeatures()
];

GET.apiDoc = {
  description: '',
  tags: ['security'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'Submission ID',
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
      description: 'Set of all security rules applied to all features belonging to the given submission.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: [
                'submission_feature_security_id',
                'submission_feature_id',
                'security_rule_id',
                'record_effective_date',
                'record_end_date',
                'create_date',
                'create_user',
                'update_date',
                'update_user',
                'revision_count'
              ],
              properties: {
                submission_feature_security_id: {
                  type: 'integer',
                  minimum: 1
                },
                submission_feature_id: {
                  type: 'integer',
                  minimum: 1
                },
                security_rule_id: {
                  type: 'integer',
                  minimum: 1
                },
                record_effective_date: {
                  type: 'string'
                },
                record_end_date: {
                  type: 'string',
                  nullable: true
                },
                create_date: {
                  type: 'string'
                },
                create_user: {
                  type: 'integer',
                  minimum: 1
                },
                update_date: {
                  type: 'string',
                  nullable: true
                },
                update_user: {
                  type: 'integer',
                  minimum: 1,
                  nullable: true
                },
                revision_count: {
                  type: 'integer',
                  minimum: 0
                }
              },
              additionalProperties: false
            }
          }
        }
      }
    },
    400: {
      $ref: '#/components/responses/400'
    },
    401: {
      $ref: '#/components/responses/401'
    },
    403: {
      $ref: '#/components/responses/403'
    },
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

export function getAllSecurityRulesForSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const securityService = new SecurityService(connection);

    try {
      await connection.open();

      const submissionId = Number(req.params.submissionId);
      const data = await securityService.getAllSecurityRulesForSubmission(submissionId);

      await connection.commit();

      return res.status(200).json(data);
    } catch (error) {
      defaultLog.error({ label: 'getAllSecurityRulesForSubmissionFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

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
    400: {
      $ref: '#/components/responses/400'
    },
    401: {
      $ref: '#/components/responses/401'
    },
    403: {
      $ref: '#/components/responses/403'
    },
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

export function patchSecurityRulesOnSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const service = new SecurityService(connection);

    const submissionFeatureIds: number[] = req.body.submissionFeatureIds;
    const applyRuleIds: number[] = req.body.applyRuleIds;
    const removeRuleIds: number[] = req.body.removeRuleIds;

    try {
      await connection.open();

      await service.patchSecurityRulesOnSubmissionFeatures(submissionFeatureIds, applyRuleIds, removeRuleIds);

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
