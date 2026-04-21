import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { UpdateTicketSystemUserStatusRequest } from '../../../../../models/ticket-system-user';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { TicketSystemUserSchema, UpdateTicketSystemUserStatusRequestSchema } from '../../../../../openapi/schemas/ticket-system-user';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TicketSystemUserService } from '../../../../../services/ticket-system-user-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}/system-user/{ticketSystemUserId}');

export const PATCH: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'SystemUser' }]
  })),
  patchTicketSystemUser()
];

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'SystemUser' }]
  })),
  deleteTicketSystemUser()
];

PATCH.apiDoc = {
  description: 'Update ticket assignee status',
  tags: ['tickets'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Ticket UUID.'
    },
    {
      in: 'path',
      name: 'ticketSystemUserId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Ticket assignee UUID.'
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: UpdateTicketSystemUserStatusRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Ticket assignee status updated successfully',
      content: {
        'application/json': {
          schema: TicketSystemUserSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

DELETE.apiDoc = {
  description: 'Delete a ticket assignee',
  tags: ['tickets'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Ticket UUID.'
    },
    {
      in: 'path',
      name: 'ticketSystemUserId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Ticket assignee UUID.'
    }
  ],
  responses: {
    204: {
      description: 'Ticket assignee deleted successfully'
    },
    ...defaultErrorResponses
  }
};

const buildActor = (req: Parameters<RequestHandler>[0], systemUserId: number) => ({
  systemUserId,
  isSystemAdmin: req.system_user?.role_names.includes(SYSTEM_ROLE.SYSTEM_ADMIN) ?? false
});

export function patchTicketSystemUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketSystemUserService = new TicketSystemUserService(connection);
      const payload = req.body as UpdateTicketSystemUserStatusRequest;

      const ticketSystemUser = await ticketSystemUserService.updateTicketAssigneeStatus(
        req.params.ticketId,
        req.params.ticketSystemUserId,
        payload,
        buildActor(req, connection.systemUserId())
      );

      await connection.commit();

      return res.status(200).json(ticketSystemUser);
    } catch (error) {
      defaultLog.error({ label: 'patchTicketSystemUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export function deleteTicketSystemUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketSystemUserService = new TicketSystemUserService(connection);

      await ticketSystemUserService.deleteTicketAssignee(
        req.params.ticketId,
        req.params.ticketSystemUserId,
        buildActor(req, connection.systemUserId())
      );

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteTicketSystemUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
