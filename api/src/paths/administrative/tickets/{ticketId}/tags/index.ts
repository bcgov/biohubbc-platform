import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { ReplaceTicketTagsRequestSchema, TicketTagsResponseSchema } from '../../../../../openapi/schemas/tag';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TicketTagService } from '../../../../../services/ticket-tag-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tickets/{ticketId}/tags');

// Tags are internal to system administrators. Unlike ticket detail, ticket team members are deliberately not
// authorized here, so tag data and tag timeline events never reach portal users.
export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getTicketTags()
];

GET.apiDoc = {
  description: 'Get the active tags of a ticket and its tag added/removed history for the admin timeline.',
  tags: ['tickets', 'tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Ticket UUID.'
    }
  ],
  responses: {
    200: {
      description: 'Ticket tags retrieved successfully',
      content: { 'application/json': { schema: TicketTagsResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  replaceTicketTags()
];

PUT.apiDoc = {
  description: 'Replace the whole tag set of a ticket.',
  tags: ['tickets', 'tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Ticket UUID.'
    }
  ],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: ReplaceTicketTagsRequestSchema } }
  },
  responses: {
    200: {
      description: 'Ticket tags replaced successfully',
      content: { 'application/json': { schema: TicketTagsResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a ticket's tags and tag history.
 *
 * @returns {RequestHandler}
 */
export function getTicketTags(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketTagService = new TicketTagService(connection);
      const ticketTags = await ticketTagService.getTicketTags(req.params.ticketId);

      await connection.commit();

      return res.status(200).json(ticketTags);
    } catch (error) {
      defaultLog.error({ label: 'getTicketTags', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Replace a ticket's tag set.
 *
 * @returns {RequestHandler}
 */
export function replaceTicketTags(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketTagService = new TicketTagService(connection);
      const ticketTags = await ticketTagService.replaceTicketTags(req.params.ticketId, req.body.tagIds);

      await connection.commit();

      return res.status(200).json(ticketTags);
    } catch (error) {
      defaultLog.error({ label: 'replaceTicketTags', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
