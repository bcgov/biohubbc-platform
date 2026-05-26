import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../openapi/schemas/pagination';
import { TicketArtifactListResponseSchema } from '../../../../../openapi/schemas/ticket';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TicketArtifactService } from '../../../../../services/ticket-artifact-service';
import { getLogger } from '../../../../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/tickets/{ticketId}/artifact');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getTicketArtifacts()
];

GET.apiDoc = {
  description: 'List paginated ticket artifacts.',
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
      in: 'query',
      name: 'search',
      required: false,
      schema: {
        type: 'string'
      },
      description: 'Optional case-insensitive search across ticket artifact ID and object key.'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Ticket artifacts retrieved successfully',
      content: {
        'application/json': {
          schema: TicketArtifactListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function getTicketArtifacts(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketArtifactService = new TicketArtifactService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      const filters = { search: req.query.search as string | undefined };

      const [artifacts, count] = await Promise.all([
        ticketArtifactService.getTicketArtifacts(
          req.params.ticketId,
          filters,
          ensureCompletePaginationOptions(pagination)
        ),
        ticketArtifactService.getTicketArtifactsCount(req.params.ticketId, filters)
      ]);

      await connection.commit();

      return res.status(200).json({
        artifacts,
        pagination: makePaginationResponse(count, pagination)
      });
    } catch (error) {
      defaultLog.error({ label: 'getTicketArtifacts', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
