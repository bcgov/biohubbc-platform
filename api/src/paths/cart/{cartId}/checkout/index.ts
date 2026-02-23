import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { CartService } from '../../../../services/cart-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/cart/{cartId}/checkout');

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
  checkoutCart()
];

POST.apiDoc = {
  description: 'Check out a cart, creating a download from all cart features',
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
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            fragment_size_bytes: {
              type: 'integer',
              minimum: 1,
              description: 'Target fragment size in bytes. Defaults to 10 MB if not provided.'
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: 'Cart checked out successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['download_id'],
            properties: {
              download_id: {
                type: 'string',
                format: 'uuid'
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Check out a cart: creates a download record linked to all cart features.
 *
 * Anonymous checkouts create downloads with `system_user_id = NULL`.
 * The download UUID is the credential — matches the existing anonymous download pattern.
 *
 * @returns {RequestHandler}
 */
export function checkoutCart(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = isAuthenticated ? connection.systemUserId() : null;
      const cartId = req.params.cartId;

      const fragmentSizeBytes = req.body?.fragment_size_bytes;

      const cartService = new CartService(connection);
      const result = await cartService.checkoutCart(cartId, systemUserId, fragmentSizeBytes);

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'checkoutCart', message: 'Error checking out cart', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
