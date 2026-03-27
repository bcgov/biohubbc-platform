import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { type UpdateTicketCommentRequest } from '../../../../../../models/ticket';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { TicketCommentSchema, UpdateTicketCommentRequestSchema } from '../../../../../../openapi/schemas/admin-ticket';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { TicketCommentService } from '../../../../../../services/ticket-comment-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tickets/{ticketId}/comment/{ticketCommentId}');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  updateTicketComment()
];

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  deleteTicketComment()
];

PUT.apiDoc = {
  description: 'Update a ticket comment by id',
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
      description: 'Ticket UUID.'
    },
    {
      in: 'path',
      name: 'ticketCommentId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Ticket comment UUID.'
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: UpdateTicketCommentRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Ticket comment updated successfully',
      content: {
        'application/json': {
          schema: TicketCommentSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

DELETE.apiDoc = {
  description: 'Delete a ticket comment by id',
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
      description: 'Ticket UUID.'
    },
    {
      in: 'path',
      name: 'ticketCommentId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Ticket comment UUID.'
    }
  ],
  responses: {
    204: {
      description: 'Ticket comment deleted successfully'
    },
    ...defaultErrorResponses
  }
};

export function updateTicketComment(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketCommentService = new TicketCommentService(connection);
      const payload = req.body as UpdateTicketCommentRequest;
      const updatedComment = await ticketCommentService.updateTicketComment({
        ticketId: req.params.ticketId,
        ticketCommentId: req.params.ticketCommentId,
        comment: payload.comment
      });

      await connection.commit();

      return res.status(200).json(updatedComment);
    } catch (error) {
      defaultLog.error({ label: 'updateTicketComment', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export function deleteTicketComment(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketCommentService = new TicketCommentService(connection);
      await ticketCommentService.deleteTicketCommentByTicketId(req.params.ticketId, req.params.ticketCommentId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteTicketComment', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
