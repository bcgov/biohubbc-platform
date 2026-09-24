import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import {
  AdministrativeContributorSchema,
  ContributorInputSchema
} from '../../../../openapi/schemas/contributor-administration';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { translateContributorError } from '../../../../request-handlers/contributor-error';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { ContributorService } from '../../../../services/contributor-service';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getAdministrativeContributor()
];
GET.apiDoc = {
  description: 'Get administrative contributors.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'contributorId', required: true, schema: { type: 'integer', minimum: 1 } }],
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: AdministrativeContributorSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Get administrative contributors within a transaction.
 * @returns Express request handler.
 */
export function getAdministrativeContributor(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorService = new ContributorService(connection);
      const result = await contributorService.getAdministrativeContributor(Number(req.params.contributorId));
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

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateAdministrativeContributor()
];
PUT.apiDoc = {
  description: 'Update administrative contributors.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'contributorId', required: true, schema: { type: 'integer', minimum: 1 } }],
  requestBody: { required: true, content: { 'application/json': { schema: ContributorInputSchema } } },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: AdministrativeContributorSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Update administrative contributors within a transaction.
 * @returns Express request handler.
 */
export function updateAdministrativeContributor(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorService = new ContributorService(connection);
      const result = await contributorService.updateAdministrativeContributor(
        Number(req.params.contributorId),
        req.body
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
  deleteAdministrativeContributor()
];
DELETE.apiDoc = {
  description: 'Delete administrative contributors.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'contributorId', required: true, schema: { type: 'integer', minimum: 1 } }],
  responses: { 204: { description: 'Deleted' }, ...defaultErrorResponses }
};

/**
 * Delete administrative contributors within a transaction.
 * @returns Express request handler.
 */
export function deleteAdministrativeContributor(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorService = new ContributorService(connection);
      await contributorService.deleteAdministrativeContributor(Number(req.params.contributorId));
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
