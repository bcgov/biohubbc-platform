import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { AdministrativeContributorCodesetSchema } from '../../../../../../openapi/schemas/contributor-codeset-administration';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { ContributorCodesetService } from '../../../../../../services/contributor-codeset-service';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getAdministrativeContributorCodeset()
];
GET.apiDoc = {
  description: "Get one of a contributor's code categories, including an ended category.",
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'path', name: 'contributorId', required: true, schema: { type: 'integer', minimum: 1 } },
    { in: 'path', name: 'contributorCodesetId', required: true, schema: { type: 'integer', minimum: 1 } }
  ],
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: AdministrativeContributorCodesetSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get one of a contributor's code categories within a transaction.
 *
 * @returns {RequestHandler} Express request handler.
 */
export function getAdministrativeContributorCodeset(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorCodesetService = new ContributorCodesetService(connection);
      const result = await contributorCodesetService.getAdministrativeContributorCodeset({
        contributorId: Number(req.params.contributorId),
        contributorCodesetId: Number(req.params.contributorCodesetId)
      });
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}
