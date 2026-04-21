import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { CreateTicketSystemUserRequest } from '../../../../models/ticket-system-user';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { CreateTicketSystemUserRequestSchema, TicketSystemUserSchema } from '../../../../openapi/schemas/ticket-system-user';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TicketSystemUserService } from '../../../../services/ticket-system-user-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}/system-user');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'SystemUser' }]
  })),
  createTicketSystemUser()
];

POST.apiDoc = {
  description: 'Create a ticket assignee',
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
        schema: CreateTicketSystemUserRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Ticket assignee created successfully',
      content: {
        'application/json': {
          schema: TicketSystemUserSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

const buildActor = (req: Parameters<RequestHandler>[0], systemUserId: number) => ({
  systemUserId,
  isSystemAdmin: req.system_user?.role_names.includes(SYSTEM_ROLE.SYSTEM_ADMIN) ?? false
});

export function createTicketSystemUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketSystemUserService = new TicketSystemUserService(connection);
      const payload = req.body as CreateTicketSystemUserRequest;

      const ticketSystemUser = await ticketSystemUserService.createTicketAssignee(
        req.params.ticketId,
        payload,
        buildActor(req, connection.systemUserId())
      );

      await connection.commit();

      return res.status(201).json(ticketSystemUser);
    } catch (error) {
      defaultLog.error({ label: 'createTicketSystemUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
