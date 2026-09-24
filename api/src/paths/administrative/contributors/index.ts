import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import {
  AdministrativeContributorSchema,
  AdministrativeContributorsSchema,
  ContributorInputSchema,
  ContributorListParameters
} from '../../../openapi/schemas/contributor-administration';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { translateContributorError } from '../../../request-handlers/contributor-error';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { ContributorService } from '../../../services/contributor-service';
import { makePaginationOptionsFromRequest } from '../../../utils/pagination';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  listAdministrativeContributors()
];
GET.apiDoc = {
  description: 'List active administrative contributors.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: ContributorListParameters,
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: AdministrativeContributorsSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * List active administrative contributors within a transaction.
 * @returns Express request handler.
 */
export function listAdministrativeContributors(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorService = new ContributorService(connection);
      const result = await contributorService.listAdministrativeContributors(
        { keyword: req.query.keyword as string | undefined, activeOnly: String(req.query.active_only) === 'true' },
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
  insertAdministrativeContributor()
];
POST.apiDoc = {
  description: 'Insert administrative contributors.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [],
  requestBody: { required: true, content: { 'application/json': { schema: ContributorInputSchema } } },
  responses: {
    201: { description: 'Success', content: { 'application/json': { schema: AdministrativeContributorSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Insert administrative contributors within a transaction.
 * @returns Express request handler.
 */
export function insertAdministrativeContributor(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorService = new ContributorService(connection);
      const result = await contributorService.insertAdministrativeContributor(req.body);
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
