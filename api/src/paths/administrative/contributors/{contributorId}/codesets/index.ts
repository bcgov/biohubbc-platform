import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import {
  AdministrativeContributorCodesetsSchema,
  ContributorCodesetListParameters
} from '../../../../../openapi/schemas/contributor-codeset-administration';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { ContributorCodesetService } from '../../../../../services/contributor-codeset-service';
import { makePaginationOptionsFromRequest } from '../../../../../utils/pagination';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  listAdministrativeContributorCodesets()
];
GET.apiDoc = {
  description: "List a contributor's code categories, including ended categories.",
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'path', name: 'contributorId', required: true, schema: { type: 'integer', minimum: 1 } },
    ...ContributorCodesetListParameters
  ],
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: AdministrativeContributorCodesetsSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List a page of a contributor's code categories within a transaction.
 *
 * @returns {RequestHandler} Express request handler.
 */
export function listAdministrativeContributorCodesets(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorCodesetService = new ContributorCodesetService(connection);
      const result = await contributorCodesetService.listAdministrativeContributorCodesets(
        Number(req.params.contributorId),
        makePaginationOptionsFromRequest(req)
      );
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
