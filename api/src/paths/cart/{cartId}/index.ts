import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { GetCartWithFeaturesSchema } from '../../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { CartService } from '../../../services/cart-service';
import { CartSubmissionFeatureService } from '../../../services/cart-submission-feature-service';
import { getLogger } from '../../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../../utils/pagination';

const defaultLog = getLogger('paths/cart/{cartId}');

export const GET: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Cart',
          cartId: req.params.cartId
        }
      ]
    };
  }),
  findCartWithFeaturesById()
];

GET.apiDoc = {
  description: 'Get a cart by cartId',
  tags: ['cart'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'cartId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      }
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Cart retrieved successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['cart', 'pagination'],
            properties: {
              cart: GetCartWithFeaturesSchema,
              pagination: paginationResponseSchema
            }
          }
        }
      }
    },
    404: {
      description: 'Cart not found'
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a cart by ID, with the first page of features
 *
 * @returns {RequestHandler}
 */
export function findCartWithFeaturesById(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const cartId = req.params.cartId;
      const cartService = new CartService(connection);
      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      // Return first 25 features from page 1 if pagination not specified
      req.query.limit = req.query.limit || '25';
      req.query.page = req.query.page || '1';

      const pagination = makePaginationOptionsFromRequest(req);

      const [cart, count] = await Promise.all([
        cartService.findCartWithFeaturesById(cartId, ensureCompletePaginationOptions(pagination)),
        cartSubmissionFeatureService.getCartSubmissionFeatureCount(cartId)
      ]);

      await connection.commit();

      res.status(200).json({ cart, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'findCartWithFeaturesById', message: 'Error fetching cart', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
