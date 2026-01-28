import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../database/db';
import { UpdateCartFeatures } from '../../../../../models/cart';
import { GetCartSubmissionFeaturesSchema } from '../../../../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../../openapi/schemas/pagination';
import { CartService } from '../../../../../services/cart-service';
import { CartSubmissionFeatureService } from '../../../../../services/cart-submission-feature-service';
import { getLogger } from '../../../../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/cart/session/{cartId}');

export const GET: Operation = [getCartSubmissionFeatures()];

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
      },
      description: 'Session ID of the cart'
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
 * GET cart by cartId
 *
 * @returns {RequestHandler}
 */
export function getCartSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    const systemUserId = connection.systemUserId();

    try {
      await connection.open();

      const pagination = makePaginationOptionsFromRequest(req);

      const cartId = req.params.cartId;
      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      const [features, count] = await Promise.all([
        cartSubmissionFeatureService.getCartSubmissionFeatures(
          cartId,
          systemUserId,
          ensureCompletePaginationOptions(pagination)
        ),
        cartSubmissionFeatureService.getCartSubmissionFeatureCount(cartId, systemUserId)
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

export const PATCH: Operation = [patchCartSubmissionFeatures()];

PATCH.apiDoc = {
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
      schema: { type: 'string', format: 'uuid' },
      description: 'Session ID of the cart'
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['add', 'remove'],
          additionalProperties: false,
          properties: {
            add: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              description: 'List of submission feature UUIDs to add to the cart'
            },
            remove: {
              type: 'array',
              items: { type: 'integer' },
              description: 'List of submission feature IDs to remove from the cart'
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
 * PATCH features to cart by cartId
 *
 * @returns {RequestHandler}
 */
export function patchCartSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    const systemUserId = connection.systemUserId();

    try {
      await connection.open();

      const body = req.body as UpdateCartFeatures;
      const cartId = req.params.cartId;

      const cartService = new CartService(connection);

      await cartService.updateCartFeatures(cartId, systemUserId, body);

      await connection.commit();

      res.status(200).json();
    } catch (error) {
      defaultLog.error({ label: 'patchCartFeatures', message: 'Error updating cart features', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const DELETE: Operation = [clearCartSubmissionFeatures()];

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
      schema: { type: 'string', format: 'uuid' },
      description: 'Session ID of the cart'
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
 * DELETE cart features by cartId
 *
 * @returns {RequestHandler}
 */
export function clearCartSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    const systemUserId = connection.systemUserId();

    try {
      await connection.open();

      const cartId = req.params.cartId;

      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      // Clear all features from the cart
      await cartSubmissionFeatureService.clearCart(cartId, systemUserId);

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
