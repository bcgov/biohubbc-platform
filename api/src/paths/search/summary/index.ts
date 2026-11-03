import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { searchSummaryResponseSchema } from '../../../openapi/schemas/search/search-summary';
import { SearchService } from '../../../services/search-service';
import { getLogger } from '../../../utils/logger';
import { getActiveSystemUserId } from '../../../utils/system-user-context';

const defaultLog = getLogger('paths/search/summary/index');

export const GET: Operation = [searchSummary()];

GET.apiDoc = {
  description: 'Get a summary count of features, submissions, and taxa for a search term.',
  tags: ['search'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'keyword',
      schema: { type: 'string' },
      required: true,
      description: 'Search term to match features, submissions, and taxa.'
    }
  ],
  responses: {
    200: {
      description: 'Summary counts for features, submissions, and taxa.',
      content: {
        'application/json': {
          schema: searchSummaryResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Returns summary of search results matching the search criteria
 *
 * @returns {RequestHandler}
 */
export function searchSummary(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = isAuthenticated ? await getActiveSystemUserId(connection) : null;
      const searchService = new SearchService(connection);

      const searchTerm = req.query.keyword as string;

      const summary = await searchService.getSearchSummary({ keyword: searchTerm }, systemUserId);

      await connection.commit();

      // Counts depend on the caller's security scopes, so only anonymous responses may be shared by caches, and a
      // cached anonymous response must not be served to an authenticated request.
      res.setHeader('Cache-Control', isAuthenticated ? 'private, no-store' : 'public, max-age=90');
      res.setHeader('Vary', 'Authorization');

      res.status(200).json(summary);
    } catch (error) {
      defaultLog.error({ label: 'searchSummary', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
