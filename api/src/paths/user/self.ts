import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { UserService } from '../../services/user-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/user/{userId}');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  getUser()
];

GET.apiDoc = {
  description: 'Get user details for the currently authenticated user.',
  tags: ['user'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'User details for the currently authenticated user.',
      content: {
        'application/json': {
          schema: {
            title: 'User Response Object',
            type: 'object',
            required: [
              'system_user_id',
              'user_identity_source_id',
              'user_identifier',
              'user_guid',
              'record_effective_date',
              'record_end_date',
              'create_date',
              'create_user',
              'update_date',
              'update_user',
              'revision_count',
              'identity_source',
              'role_ids',
              'role_names'
            ],
            properties: {
              system_user_id: {
                description: 'user id',
                type: 'integer',
                minimum: 1
              },
              user_identity_source_id: {
                type: 'integer'
              },
              user_identifier: {
                description: 'The unique user identifier',
                type: 'string'
              },
              user_guid: {
                type: 'string',
                description: 'The GUID for the user.',
                nullable: true
              },
              record_effective_date: {
                type: 'string'
              },
              record_end_date: {
                type: 'string',
                nullable: true
              },
              create_date: {
                type: 'string'
              },
              create_user: {
                type: 'integer',
                minimum: 1
              },
              update_date: {
                type: 'string',
                nullable: true
              },
              update_user: {
                type: 'integer',
                minimum: 1,
                nullable: true
              },
              revision_count: {
                type: 'integer',
                minimum: 0
              },
              identity_source: {
                type: 'string'
              },
              role_ids: {
                description: 'list of role ids for the user',
                type: 'array',
                items: {
                  type: 'integer',
                  minimum: 1
                }
              },
              role_names: {
                description: 'list of role names for the user',
                type: 'array',
                items: {
                  type: 'string'
                }
              }
            },
            additionalProperties: false
          }
        }
      }
    },
    400: {
      $ref: '#/components/responses/400'
    },
    401: {
      $ref: '#/components/responses/401'
    },
    403: {
      $ref: '#/components/responses/403'
    },
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

/**
 * Get the currently logged in user.
 *
 * @returns {RequestHandler}
 */
export function getUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const userId = connection.systemUserId();

      if (!userId) {
        throw new HTTP400('Failed to identify system user ID');
      }

      const userService = new UserService(connection);

      // Fetch system user record
      const userObject = await userService.getUserById(userId);

      await connection.commit();

      return res.status(200).json(userObject);
    } catch (error) {
      defaultLog.error({ label: 'getUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
