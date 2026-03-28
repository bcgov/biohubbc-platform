import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../openapi/schemas/pagination';
import { TicketListResponseSchema } from '../../openapi/schemas/ticket';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { TeamMemberService } from '../../services/access-policy/team-member-service';
import { TicketService } from '../../services/ticket-service';
import { getLogger } from '../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../utils/pagination';

const defaultLog = getLogger('paths/portal/tickets');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'SystemUser' }]
  })),
  getTicketsForUser()
];

GET.apiDoc = {
  description: 'List tickets accessible to the current user via team membership',
  tags: ['portal'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'status',
      required: false,
      schema: {
        type: 'string',
        enum: ['open', 'closed']
      }
    },
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: {
        type: 'string'
      },
      description: 'Optional case-insensitive search across ticket slug, subject, and description.'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Tickets retrieved successfully',
      content: {
        'application/json': {
          schema: TicketListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get tickets accessible to the authenticated user via team membership.
 *
 * @return {RequestHandler}
 */
export function getTicketsForUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    const status = req.query.status as 'open' | 'closed' | undefined;
    const search = req.query.search as string | undefined;

    const pagination = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

      const teamMemberService = new TeamMemberService(connection);
      const teamIds = await teamMemberService.getTeamIdsBySystemUserId(systemUserId);

      const filters = { team_ids: teamIds, status, search };

      const ticketService = new TicketService(connection);
      const [tickets, count] = await Promise.all([
        ticketService.getTickets(filters, pagination),
        ticketService.getTicketsCount(filters)
      ]);

      await connection.commit();

      return res.status(200).json({
        tickets,
        pagination: makePaginationResponse(count, pagination)
      });
    } catch (error) {
      defaultLog.error({ label: 'getTicketsForUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
