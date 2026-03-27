import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { type CreateTicketReferenceRequest } from '../../../../../models/ticket-reference';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { CreateTicketReferenceRequestSchema, TicketReferenceSchema } from '../../../../../openapi/schemas/admin-ticket';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TicketService } from '../../../../../services/ticket-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tickets/{ticketId}/reference');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  createTicketReference()
];

POST.apiDoc = {
  description: 'Add a reference from a ticket to another ticket',
  tags: ['tickets'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Source ticket UUID.'
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: CreateTicketReferenceRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Ticket references created successfully',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: TicketReferenceSchema
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function createTicketReference(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketService = new TicketService(connection);
      const payload = req.body as CreateTicketReferenceRequest;
      const createdReferences = await ticketService.createTicketReference(req.params.ticketId, payload);

      await connection.commit();

      return res.status(201).json(createdReferences);
    } catch (error) {
      defaultLog.error({ label: 'createTicketReference', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
