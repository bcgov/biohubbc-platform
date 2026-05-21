import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { CompleteTicketUpload } from '../../../../../../models/ticket-upload';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { TicketArtifactSchema } from '../../../../../../openapi/schemas/ticket';
import { CompleteTicketUploadSchema } from '../../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { TicketUploadService } from '../../../../../../services/ticket-upload-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tickets/{ticketId}/upload/{uploadId}');

export const PUT: Operation = [
  authorizeRequestHandler((req) => ({
    or: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      },
      { discriminator: 'Team', entity: 'ticket', ticketId: req.params.ticketId }
    ]
  })),
  completeTicketUpload()
];

PUT.apiDoc = {
  description: 'Finalize ticket upload and asynchronously trigger security scan processing.',
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
      name: 'uploadId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Upload lifecycle UUID returned by upload initialization.'
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CompleteTicketUploadSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Upload completed and ticket attachment returned',
      content: {
        'application/json': {
          schema: TicketArtifactSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function completeTicketUpload(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const payload = req.body as CompleteTicketUpload;
      const ticketUploadService = new TicketUploadService(connection);

      const response = await ticketUploadService.completeTicketUpload(
        req.params.ticketId,
        req.params.uploadId,
        payload
      );

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'completeTicketUpload', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
