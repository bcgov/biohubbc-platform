import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TicketStatusHistoryListResponseSchema } from '../../../../openapi/schemas/ticket';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TicketService } from '../../../../services/ticket-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}/status-history');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getTicketStatusHistory()
];

GET.apiDoc = {
  description: 'Get immutable ticket status history by ticket ID',
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
      }
    }
  ],
  responses: {
    200: {
      description: 'Ticket status history retrieved successfully',
      content: {
        'application/json': {
          schema: TicketStatusHistoryListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function getTicketStatusHistory(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketService = new TicketService(connection);
      const history = await ticketService.getTicketStatusHistory(req.params.ticketId);

      await connection.commit();

      return res.status(200).json(history);
    } catch (error) {
      defaultLog.error({ label: 'getTicketStatusHistory', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
