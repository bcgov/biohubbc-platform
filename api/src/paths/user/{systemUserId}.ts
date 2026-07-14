import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { IUpdateSystemUserParams } from '../../models/system-user';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { UpdateSystemUserRequestSchema } from '../../openapi/schemas/user';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { UserService } from '../../services/user-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/user/{systemUserId}');

export const PATCH: Operation = [
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
  updateSystemUser()
];

PATCH.apiDoc = {
  description: 'Update a system user.',
  tags: ['user'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'systemUserId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    }
  ],
  requestBody: {
    description: 'Update a system user request object.',
    content: {
      'application/json': {
        schema: UpdateSystemUserRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Update system user OK.'
    },
    ...defaultErrorResponses
  }
};

export function updateSystemUser(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({
      label: 'updateSystemUser',
      message: 'params',
      req_params: req.params,
      req_body: req.body
    });

    const systemUserId = Number(req.params.systemUserId);
    const updates = req.body as Partial<IUpdateSystemUserParams>;
    const recordEndDate = updates.record_end_date;

    if (recordEndDate !== null && typeof recordEndDate !== 'string') {
      throw new HTTP400('Missing required body param: record_end_date');
    }

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const userService = new UserService(connection);

      await userService.updateSystemUser(systemUserId, { record_end_date: recordEndDate });

      await connection.commit();

      return res.status(200).send();
    } catch (error) {
      defaultLog.error({ label: 'updateSystemUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
