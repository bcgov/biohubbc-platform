import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { GetCartSubmissionFeaturesSchema } from '../../../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../openapi/schemas/pagination';
import { CartSubmissionFeatureService } from '../../../../services/cart-submission-feature-service';
import { getLogger } from '../../../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../../../utils/pagination';

const defaultLog = getLogger('paths/cart/{cartId}');

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
 * GET cart by cartId
 *
 * @returns {RequestHandler}
 */
export function getCartSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

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

export const POST: Operation = [addSubmissionFeaturesToCart()];

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
              items: { type: 'string', format: 'uuid' },
              description: 'List of submission feature UUIDs to add to the cart'
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
export function addSubmissionFeaturesToCart(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

      const features = req.body.features as string[];
      const cartId = req.params.cartId;

      const cartService = new CartSubmissionFeatureService(connection);

      await cartService.addSubmissionFeaturesToCart(cartId, systemUserId, features);

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
 * DELETE cart features by cartId
 *
 * @returns {RequestHandler}
 */
export function clearCartSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

      const cartId = req.params.cartId;

      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

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
