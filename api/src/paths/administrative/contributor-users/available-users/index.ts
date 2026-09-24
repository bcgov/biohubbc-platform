import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationResponseSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { UserService } from '../../../../services/user-service';
import { makePaginationOptionsFromRequest } from '../../../../utils/pagination';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  listContributorSystemUserOptions()
];
GET.apiDoc = {
  description: 'List paginated contributor assignment user options, including all identity sources.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
    { in: 'query', name: 'keyword', schema: { type: 'string' } }
  ],
  responses: {
    200: {
      description: 'User options',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['users', 'pagination'],
            properties: {
              users: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['system_user_id', 'user_identifier', 'display_name', 'record_end_date'],
                  properties: {
                    system_user_id: { type: 'integer' },
                    user_identifier: { type: 'string' },
                    display_name: { type: 'string', nullable: true },
                    record_end_date: { type: 'string', nullable: true }
                  }
                }
              },
              pagination: paginationResponseSchema
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * List user options in an authenticated transaction.
 * @returns Express request handler.
 */
export function listContributorSystemUserOptions(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const userService = new UserService(connection);
      const result = await userService.listContributorSystemUserOptions(
        { keyword: req.query.keyword as string | undefined },
        makePaginationOptionsFromRequest(req)
      );
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
