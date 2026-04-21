import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { CreateTicketSystemUser } from '../../../../models/ticket-system-user';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  CreateTicketSystemUsersRequestSchema,
  TicketSystemUserSchema
} from '../../../../openapi/schemas/ticket-system-user';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TicketSystemUserService } from '../../../../services/ticket-system-user-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}/system-user');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  createTicketSystemUser()
];

POST.apiDoc = {
  description: 'Create ticket assignees in bulk',
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
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: CreateTicketSystemUsersRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Ticket assignees created successfully',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: TicketSystemUserSchema
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function createTicketSystemUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketSystemUserService = new TicketSystemUserService(connection);
      const payload = req.body as CreateTicketSystemUser[];

      const ticketSystemUsers = await ticketSystemUserService.createTicketAssignees(req.params.ticketId, payload);

      await connection.commit();

      return res.status(201).json(ticketSystemUsers);
    } catch (error) {
      defaultLog.error({ label: 'createTicketSystemUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
