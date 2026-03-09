import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TicketService } from '../../../../../services/ticket-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}/reference/{ticketReferenceId}');

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteTicketReference()
];

DELETE.apiDoc = {
  description: 'Delete a ticket reference by id',
  tags: ['tickets'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Ticket UUID.'
    },
    {
      in: 'path',
      name: 'ticketReferenceId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Ticket reference UUID.'
    }
  ],
  responses: {
    204: { description: 'Ticket reference deleted successfully' },
    ...defaultErrorResponses
  }
};

/**
 * Delete a ticket reference.
 *
 * @returns {RequestHandler}
 */
export function deleteTicketReference(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketService = new TicketService(connection);
      await ticketService.deleteTicketReference(req.params.ticketId, req.params.ticketReferenceId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteTicketReference', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
