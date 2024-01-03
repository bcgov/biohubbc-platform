import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_IDENTITY_SOURCE } from '../../../constants/database';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { AdministrativeService } from '../../../services/administrative-service';
import { GCNotifyService } from '../../../services/gcnotify-service';
import { UserService } from '../../../services/user-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/access-request/update');

export const PUT: Operation = [
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
  updateAccessRequest()
];

PUT.apiDoc = {
  description: "Update a user's system access request and add any specified system roles to the user.",
  tags: ['user'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['userGuid', 'userIdentifier', 'identitySource', 'requestId', 'requestStatusTypeId'],
          properties: {
            userGuid: {
              type: 'string',
              description: 'The GUID for the user.'
            },
            userIdentifier: {
              type: 'string',
              description: 'The user identifier for the user.'
            },
            identitySource: {
              type: 'string',
              enum: [
                SYSTEM_IDENTITY_SOURCE.IDIR,
                SYSTEM_IDENTITY_SOURCE.BCEID_BASIC,
                SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS
              ]
            },
            requestId: {
              type: 'number',
              description: 'The id of the access request to update.'
            },
            requestStatusTypeId: {
              type: 'number',
              description: 'The status type id to set for the access request.'
            },
            roleIds: {
              type: 'array',
              items: {
                type: 'number'
              },
              description:
                'An array of role ids to add, if the access-request was approved. Ignored if the access-request was denied.'
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Add system user roles to user OK.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Updates an access request.
 *
 * key steps performed:
 * - Get the user by their user identifier
 * - If user is not found, add them
 * - Determine if there are any new roles to add, and add them if there are
 * - Update the administrative activity record status
 *
 * @return {*}  {RequestHandler}
 */
export function updateAccessRequest(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'updateAccessRequest', message: 'params', req_body: req.body });

    const userGuid = req.body?.userGuid;
    const userIdentifier = req.body?.userIdentifier;
    const identitySource = req.body?.identitySource;
    const administrativeActivityId = Number(req.body?.requestId);
    const administrativeActivityStatusTypeId = Number(req.body?.requestStatusTypeId);
    const roleIds: number[] = req.body?.roleIds || [];

    const connection = getDBConnection(req['keycloak_token']);
    const gcnotifyService = new GCNotifyService(connection);
    const administrativeService = new AdministrativeService(connection);

    try {
      await connection.open();

      const userService = new UserService(connection);

      // Get the system user (adding or activating them if they already existed).
      const systemUserObject = await userService.ensureSystemUser(userGuid, userIdentifier, identitySource);

      // Filter out any system roles that have already been added to the user
      const rolesIdsToAdd = roleIds.filter((roleId) => !systemUserObject.role_ids.includes(roleId));

      if (rolesIdsToAdd?.length) {
        // Add any missing roles (if any)
        await userService.addUserSystemRoles(systemUserObject.system_user_id, rolesIdsToAdd);
      }

      // Update the access request record status
      await administrativeService.updateAdministrativeActivity(
        administrativeActivityId,
        administrativeActivityStatusTypeId
      );

      //if the access request is an approval send Approval email
      await gcnotifyService.sendApprovalEmail(administrativeActivityStatusTypeId, userIdentifier, identitySource);

      await connection.commit();

      return res.status(200).send();
    } catch (error) {
      defaultLog.error({ label: 'updateAccessRequest', message: 'error', error });
      throw error;
    } finally {
      connection.release();
    }
  };
}
