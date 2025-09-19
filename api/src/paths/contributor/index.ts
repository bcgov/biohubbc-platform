import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ContributorService } from '../../services/contributor-service';
import { getServiceClientSystemUser } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';
import { CreateContributor } from './index.interface';

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
  registerNewContributor()
];

POST.apiDoc = {
  description: 'Registers the requesting service account as a new contributor',
  tags: ['codeset'],
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Codeset accepted successfully.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Registers the system that the requestor is a service account for as a new contributor,
 * and associates the service account with that contributor, letting the service account create submissions
 * on behalf of its associated system (eg. SIMS)
 *
 * @returns {RequestHandler}
 */
export function registerNewContributor(): RequestHandler {
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

      const contributorService = new ContributorService(connection);

      const contributor = {
        clientId: req['keycloak_token'].clientId,
        members: [{ system_user_id: serviceClientSystemUser.system_user_id }]
      } as CreateContributor;

      await contributorService.addNewContributor(contributor);

      await connection.commit();

      return res.sendStatus(201);
    } catch (error) {
      defaultLog.error({ label: 'registerNewContributor', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
