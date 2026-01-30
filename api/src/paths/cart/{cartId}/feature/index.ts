import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { GetCartSubmissionFeaturesSchema } from '../../../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { CartSubmissionFeatureService } from '../../../../services/cart-submission-feature-service';
import { getLogger } from '../../../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../../../utils/pagination';

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
  getCartSubmissionFeatures()
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
            required: ['features', 'pagination'],
            properties: {
              features: GetCartSubmissionFeaturesSchema,
              pagination: paginationResponseSchema
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get features in a cart, paginated
 *
 * @returns {RequestHandler}
 */
export function getCartSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const pagination = makePaginationOptionsFromRequest(req);

      const cartId = req.params.cartId;
      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      const [features, count] = await Promise.all([
        cartSubmissionFeatureService.getCartSubmissionFeatures(cartId, ensureCompletePaginationOptions(pagination)),
        cartSubmissionFeatureService.getCartSubmissionFeatureCount(cartId)
      ]);

      await connection.commit();

      res.status(200).json({ features, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getCartById', message: 'Error fetching cart', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
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
  addSubmissionFeaturesToCart()
];

POST.apiDoc = {
  description: 'Add or remove features in the cart',
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
      schema: { type: 'string', format: 'uuid' }
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['features'],
          additionalProperties: false,
          properties: {
            features: {
              type: 'array',
              items: { type: 'integer' },
              description: 'List of submission feature IDs to add to the cart'
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Successfully updated the cart'
    },
    ...defaultErrorResponses
  }
};

/**
 * Add new features to the cart
 *
 * @returns {RequestHandler}
 */
export function addSubmissionFeaturesToCart(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const features = req.body.features.map(Number);
      const cartId = req.params.cartId;

      const cartService = new CartSubmissionFeatureService(connection);

      await cartService.addSubmissionFeaturesToCart(cartId, features);

      await connection.commit();

      res.status(200).json();
    } catch (error) {
      defaultLog.error({ label: 'addSubmissionFeaturesToCart', message: 'Error updating cart features', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const DELETE: Operation = [
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
  clearCartSubmissionFeatures()
];

DELETE.apiDoc = {
  description: 'Clear all features from the cart by cartId',
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
      schema: { type: 'string', format: 'uuid' }
    }
  ],
  responses: {
    200: {
      description: 'Cart features cleared successfully'
    },
    ...defaultErrorResponses
  }
};

/**
 * Delete all features from the cart
 *
 * @returns {RequestHandler}
 */
export function clearCartSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const cartId = req.params.cartId;

      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      await cartSubmissionFeatureService.clearCart(cartId);

      await connection.commit();

      res.status(200).json();
    } catch (error) {
      defaultLog.error({ label: 'clearCartFeatures', message: 'Error clearing cart features', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
