import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { CartWithFeaturesResponseSchema } from '../../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { CartService } from '../../../services/cart-service';
import { CartSubmissionFeatureService } from '../../../services/cart-submission-feature-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../utils/pagination';

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
  getCartWithFeaturesById()
];

export const PUT: Operation = [
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
  claimCartForCurrentUser()
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
          schema: CartWithFeaturesResponseSchema
        }
      }
    },
    404: {
      description: 'Cart not found'
    },
    ...defaultErrorResponses
  }
};

PUT.apiDoc = {
  description: 'Assign a cart to the currently authenticated user',
  tags: ['cart'],
  security: [
    {
      Bearer: []
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
    }
  ],
  responses: {
    200: {
      description: 'Cart assigned successfully'
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a cart by ID, with the first page of features
 *
 * @returns {RequestHandler}
 */
export function getCartWithFeaturesById(): RequestHandler {
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

      const cart = await cartService.getCartById(cartId);

      const paginatedFeatures = await cartSubmissionFeatureService.getPaginatedCartFeaturesResponse(cartId, pagination);

      await connection.commit();

      res.status(200).json({
        ...paginatedFeatures,
        cart
      });
    } catch (error) {
      defaultLog.error({ label: 'findCartWithFeaturesById', message: 'Error fetching cart', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Assign an existing cart to the currently authenticated user.
 *
 * @returns {RequestHandler}
 */
export function claimCartForCurrentUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

      const cartId = req.params.cartId;
      const cartService = new CartService(connection);

      await cartService.updateCart(cartId, { system_user_id: systemUserId });

      await connection.commit();

      return res.sendStatus(200);
    } catch (error) {
      defaultLog.error({ label: 'claimCartForCurrentUser', message: 'Error claiming cart', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
