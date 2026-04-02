import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { CartFeatureIdsRequestSchema, CartFeaturesResponseSchema } from '../../../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { CartSubmissionFeatureService } from '../../../../services/cart-submission-feature-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../utils/pagination';

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
    {
      in: 'query',
      name: 'submissionFeatureId',
      required: false,
      schema: { type: 'integer' },
      description: 'Filter results to a specific submission feature ID'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Cart retrieved successfully',
      content: {
        'application/json': {
          schema: CartFeaturesResponseSchema
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
      const submissionFeatureId = Number(req.query.submissionFeatureId) || undefined;

      const cartId = req.params.cartId;
      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      const response = await cartSubmissionFeatureService.getPaginatedCartFeaturesResponse(
        cartId,
        pagination,
        submissionFeatureId
      );

      await connection.commit();

      return res.status(200).json(response);
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
  createCartSubmissionFeatures()
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
    },
    ...paginationRequestQueryParamSchema
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CartFeatureIdsRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Successfully updated the cart',
      content: {
        'application/json': {
          schema: CartFeaturesResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Add new features to the cart
 *
 * @returns {RequestHandler}
 */
export function createCartSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const features = req.body.features.map(Number);
      const cartId = req.params.cartId;
      const pagination = makePaginationOptionsFromRequest(req);
      const systemUserId = isAuthenticated ? connection.systemUserId() : null;

      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      await cartSubmissionFeatureService.createCartSubmissionFeatures(cartId, features, systemUserId);
      const response = await cartSubmissionFeatureService.getPaginatedCartFeaturesResponse(cartId, pagination);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'createCartSubmissionFeatures', message: 'Error updating cart features', error });
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
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Cart features cleared successfully',
      content: {
        'application/json': {
          schema: CartFeaturesResponseSchema
        }
      }
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
      const pagination = makePaginationOptionsFromRequest(req);

      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      await cartSubmissionFeatureService.clearCart(cartId);
      const response = await cartSubmissionFeatureService.getPaginatedCartFeaturesResponse(cartId, pagination);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'clearCartFeatures', message: 'Error clearing cart features', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
