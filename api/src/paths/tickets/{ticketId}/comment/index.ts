import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { CreateTicketCommentRequest } from '../../../../models/ticket';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { CreateTicketCommentRequestSchema, TicketStatusHistorySchema } from '../../../../openapi/schemas/ticket';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TicketService } from '../../../../services/ticket-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}/comment');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createTicketComment()
];

POST.apiDoc = {
  description: 'Add a comment to a ticket timeline',
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
        schema: CreateTicketCommentRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Ticket comment created successfully',
      content: {
        'application/json': {
          schema: TicketStatusHistorySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function createTicketComment(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketService = new TicketService(connection);
      const commentPayload = CreateTicketCommentRequest.parse(req.body);
      const historyItem = await ticketService.createTicketComment(req.params.ticketId, commentPayload);

      await connection.commit();

      return res.status(200).json(historyItem);
    } catch (error) {
      defaultLog.error({ label: 'createTicketComment', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
