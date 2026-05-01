import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { CreateTicketUpload } from '../../../../../models/ticket-upload';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { CreateTicketUploadResponseSchema, CreateTicketUploadSchema } from '../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TicketUploadService } from '../../../../../services/ticket-upload-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tickets/{ticketId}/upload');

export const POST: Operation = [
  authorizeRequestHandler((req) => ({
    or: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      },
      { discriminator: 'Team', entity: 'ticket', ticketId: req.params.ticketId }
    ]
  })),
  createTicketUpload()
];

POST.apiDoc = {
  description: 'Initialize a ticket attachment upload and return a presigned upload URL.',
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
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateTicketUploadSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Ticket upload initialized successfully',
      content: {
        'application/json': {
          schema: CreateTicketUploadResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function createTicketUpload(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const payload = req.body as CreateTicketUpload;
      const ticketUploadService = new TicketUploadService(connection);
      const response = await ticketUploadService.initializeTicketUpload(req.params.ticketId, payload);

      await connection.commit();

      return res.status(201).json(response);
    } catch (error) {
      defaultLog.error({ label: 'createTicketUpload', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
