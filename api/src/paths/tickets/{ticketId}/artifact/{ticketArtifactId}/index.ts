import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { HTTP401 } from '../../../../../errors/http-error';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { ArtifactDownloadResponseSchema } from '../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TicketArtifactService } from '../../../../../services/ticket-artifact-service';
import { ArtifactService } from '../../../../../services/upload/artifact-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}/artifact/{ticketArtifactId}');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    or: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      },
      { discriminator: 'Team', entity: 'ticket', ticketId: req.params.ticketId }
    ]
  })),
  getArtifactDownloadUrl()
];

GET.apiDoc = {
  description: 'Get a presigned download URL for a ticket attachment artifact.',
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
      name: 'ticketArtifactId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Ticket attachment UUID.'
    }
  ],
  responses: {
    200: {
      description: 'Ticket attachment download URL retrieved successfully',
      content: {
        'application/json': {
          schema: ArtifactDownloadResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function getArtifactDownloadUrl(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketArtifactService = new TicketArtifactService(connection);
      const artifactService = new ArtifactService(connection);

      const ticketArtifact = await ticketArtifactService.findTicketArtifactById(
        req.params.ticketId,
        req.params.ticketArtifactId
      );

      if (!ticketArtifact) {
        throw new HTTP401('Access Denied');
      }

      const signedUrl = await artifactService.getArtifactSignedUrl(ticketArtifact.artifact_id);

      await connection.commit();

      return res.status(200).json({ signed_url: signedUrl });
    } catch (error) {
      defaultLog.error({ label: 'getArtifactDownloadUrl', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
