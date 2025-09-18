import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { CreateCodesetSchema } from '../../openapi/schemas/codeset';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ContributorCodesetService } from '../../services/contributor-codeset-service';
import { getServiceClientSystemUser } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';
import { CreateCodeset } from './index.interface';

const defaultLog = getLogger('paths/codeset');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'ServiceClient'
        }
      ]
    };
  }),
  submitCodeSet()
];

POST.apiDoc = {
  description: 'Submit a codeset for a contributing data system',
  tags: ['codeset'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateCodesetSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Codeset accepted successfully.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Handles the submission of a codeset for a contributing data system
 *
 * @returns {RequestHandler}
 */
export function submitCodeSet(): RequestHandler {
  return async (req, res) => {
    const serviceClientSystemUser = getServiceClientSystemUser(req['keycloak_token']);

    if (!serviceClientSystemUser) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a sub or sub value is unknown'
      ]);
    }

    const connection = getServiceAccountDBConnection(serviceClientSystemUser);

    try {
      await connection.open();

      const codeset = { ...req.body, contributor_id: 1 } as CreateCodeset;

      const contributorCodesetService = new ContributorCodesetService(connection);

      await contributorCodesetService.upsertCodeset(codeset);

      await connection.commit();

      return res.sendStatus(201);
    } catch (error) {
      defaultLog.error({ label: 'submitCodeSet', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
