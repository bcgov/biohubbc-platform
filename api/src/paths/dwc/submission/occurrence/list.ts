import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { OccurrenceService } from '../../../../services/occurrence-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/occurrence/list');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  listOccurrences()
];

GET.apiDoc = {
  description: 'List all occurrences',
  tags: ['dwc', 'occurrence'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'spatial',
      schema: {
        type: 'string',
        nullable: true
      },
      allowEmptyValue: true
    }
  ],
  responses: {
    200: {
      description: 'Darwin Core data packages.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              title: '',
              type: 'object',
              properties: {
                //
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function listOccurrences(): RequestHandler {
  return async (req, res) => {
    const searchCriteria: { spatial?: string } = req.query || {};

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const occurrenceService = new OccurrenceService(connection);

      const submissions = await occurrenceService.getMapOccurrences(searchCriteria.spatial);

      await connection.commit();

      res.status(200).json(submissions);
    } catch (error) {
      defaultLog.error({ label: 'listOccurrences', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
