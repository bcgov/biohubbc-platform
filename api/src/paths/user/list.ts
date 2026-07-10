import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { UserService } from '../../services/user-service';
import { getLogger } from '../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../utils/pagination';

const defaultLog = getLogger('paths/user');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getUserList()
];

GET.apiDoc = {
  description: 'Get all Users.',
  tags: ['user'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      schema: {
        type: 'string'
      },
      required: false
    }
  ],
  responses: {
    200: {
      description: 'User response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['users', 'pagination'],
            properties: {
              users: {
                type: 'array',
                items: {
                  title: 'User Response Object',
                  type: 'object',
                  properties: {
                    id: {
                      type: 'number'
                    },
                    user_identifier: {
                      type: 'string'
                    },
                    user_guid: {
                      type: 'string',
                      description: 'The GUID for the user.'
                    },
                    record_end_date: {
                      type: 'string',
                      nullable: true
                    },
                    role_ids: {
                      type: 'array',
                      items: {
                        oneOf: [{ type: 'number' }, { type: 'string' }]
                      }
                    },
                    role_names: {
                      type: 'array',
                      items: {
                        type: 'string'
                      }
                    }
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
 * Get all users.
 *
 * @returns {RequestHandler}
 */
export function getUserList(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const userService = new UserService(connection);
      const search = req.query.search as string | undefined;
      const pagination = makePaginationOptionsFromRequest(req);

      const [users, count] = await Promise.all([
        userService.listSystemUsers(search, ensureCompletePaginationOptions(pagination)),
        userService.getSystemUsersCount(search)
      ]);

      await connection.commit();

      return res.status(200).json({
        users,
        pagination: makePaginationResponse(count, pagination)
      });
    } catch (error) {
      defaultLog.error({ label: 'getUserList', message: 'error', error });
      throw error;
    } finally {
      connection.release();
    }
  };
}
