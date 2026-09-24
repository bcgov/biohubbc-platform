import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { AdministrativeContributorSystemUserSchema } from '../../../../openapi/schemas/contributor-system-user-administration';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { translateContributorError } from '../../../../request-handlers/contributor-error';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { ContributorSystemUserService } from '../../../../services/contributor-system-user-service';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getAdministrativeContributorSystemUser()
];
GET.apiDoc = {
  description: 'Get administrative contributor-users.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'path', name: 'contributorSystemUserId', required: true, schema: { type: 'integer', minimum: 1 } }
  ],
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: AdministrativeContributorSystemUserSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get administrative contributor-users within a transaction.
 * @returns Express request handler.
 */
export function getAdministrativeContributorSystemUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorSystemUserService = new ContributorSystemUserService(connection);
      const result = await contributorSystemUserService.getAdministrativeContributorSystemUser(
        Number(req.params.contributorSystemUserId)
      );
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      await connection.rollback();
      throw translateContributorError(error);
    } finally {
      connection.release();
    }
  };
}

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteAdministrativeContributorSystemUser()
];
DELETE.apiDoc = {
  description: 'Delete administrative contributor-users.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'path', name: 'contributorSystemUserId', required: true, schema: { type: 'integer', minimum: 1 } }
  ],
  responses: { 204: { description: 'Deleted' }, ...defaultErrorResponses }
};

/**
 * Delete administrative contributor-users within a transaction.
 * @returns Express request handler.
 */
export function deleteAdministrativeContributorSystemUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorSystemUserService = new ContributorSystemUserService(connection);
      await contributorSystemUserService.deleteAdministrativeContributorSystemUser(
        Number(req.params.contributorSystemUserId)
      );
      await connection.commit();
      return res.status(204).end();
    } catch (error) {
      await connection.rollback();
      throw translateContributorError(error);
    } finally {
      connection.release();
    }
  };
}
