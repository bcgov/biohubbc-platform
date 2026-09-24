import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import {
  AdministrativeContributorSystemUserSchema,
  AdministrativeContributorSystemUsersSchema,
  ContributorSystemUserInputSchema,
  ContributorSystemUserListParameters
} from '../../../openapi/schemas/contributor-system-user-administration';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { translateContributorError } from '../../../request-handlers/contributor-error';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { ContributorSystemUserService } from '../../../services/contributor-system-user-service';
import { makePaginationOptionsFromRequest } from '../../../utils/pagination';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  listAdministrativeContributorSystemUsers()
];
GET.apiDoc = {
  description: 'List administrative contributor-users.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: ContributorSystemUserListParameters,
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: AdministrativeContributorSystemUsersSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List administrative contributor-users within a transaction.
 * @returns Express request handler.
 */
export function listAdministrativeContributorSystemUsers(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorSystemUserService = new ContributorSystemUserService(connection);
      const result = await contributorSystemUserService.listAdministrativeContributorSystemUsers(
        {
          keyword: req.query.keyword as string | undefined,
          activeOnly: String(req.query.active_only) === 'true',
          contributorId: req.query.contributor_id === undefined ? undefined : Number(req.query.contributor_id)
        },
        makePaginationOptionsFromRequest(req)
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

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  insertAdministrativeContributorSystemUser()
];
POST.apiDoc = {
  description: 'Insert administrative contributor-users.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [],
  requestBody: { required: true, content: { 'application/json': { schema: ContributorSystemUserInputSchema } } },
  responses: {
    201: {
      description: 'Success',
      content: { 'application/json': { schema: AdministrativeContributorSystemUserSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Insert administrative contributor-users within a transaction.
 * @returns Express request handler.
 */
export function insertAdministrativeContributorSystemUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorSystemUserService = new ContributorSystemUserService(connection);
      const result = await contributorSystemUserService.insertAdministrativeContributorSystemUser(req.body);
      await connection.commit();
      return res.status(201).json(result);
    } catch (error) {
      await connection.rollback();
      throw translateContributorError(error);
    } finally {
      connection.release();
    }
  };
}
