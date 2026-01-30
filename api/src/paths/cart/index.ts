import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../database/db';
import { GetCartWithFeaturesSchema } from '../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { CartService } from '../../services/cart-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/cart');

export const POST: Operation = [createCart()];

POST.apiDoc = {
  description: 'Create a new cart for the current user (backend generates session ID if needed)',
  tags: ['cart'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  requestBody: {
    required: false,
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
    201: {
      description: 'Cart created successfully',
      content: {
        'application/json': {
          schema: GetCartWithFeaturesSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Creates a new cart.
 *
 * @returns {RequestHandler}
 */
export function createCart(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const features = (req.body?.features ?? []) as string[];

      const cartService = new CartService(connection);

      const cart = await cartService.createCart(systemUserId, features);

      await connection.commit();

      res.status(201).json(cart);
    } catch (error) {
      defaultLog.error({ label: 'createCart', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
