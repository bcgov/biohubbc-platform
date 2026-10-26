import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import {
  AdministrativeContributorCodesetCodesSchema,
  ContributorCodesetListParameters
} from '../../../../../../../openapi/schemas/contributor-codeset-administration';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { ContributorCodesetCodeService } from '../../../../../../../services/contributor-codeset-code-service';
import { makePaginationOptionsFromRequest } from '../../../../../../../utils/pagination';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  listAdministrativeContributorCodesetCodes()
];
GET.apiDoc = {
  description: "List the values of one of a contributor's code categories, including ended values.",
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'path', name: 'contributorId', required: true, schema: { type: 'integer', minimum: 1 } },
    { in: 'path', name: 'contributorCodesetId', required: true, schema: { type: 'integer', minimum: 1 } },
    ...ContributorCodesetListParameters
  ],
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: AdministrativeContributorCodesetCodesSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List a page of one of a contributor's code category values within a transaction.
 *
 * @returns {RequestHandler} Express request handler.
 */
export function listAdministrativeContributorCodesetCodes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const contributorCodesetCodeService = new ContributorCodesetCodeService(connection);
      const result = await contributorCodesetCodeService.listAdministrativeContributorCodesetCodes(
        {
          contributorId: Number(req.params.contributorId),
          contributorCodesetId: Number(req.params.contributorCodesetId)
        },
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
