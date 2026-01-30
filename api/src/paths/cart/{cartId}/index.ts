import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { GetCartWithFeaturesSchema } from '../../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { CartService } from '../../../services/cart-service';
import { getLogger } from '../../../utils/logger';

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
    }
  ],
  responses: {
    200: {
      description: 'Cart retrieved successfully',
      content: {
        'application/json': {
          schema: GetCartWithFeaturesSchema
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

      const cart = await cartService.findCartWithFeaturesById(cartId);

      await connection.commit();

      res.status(200).json(cart);
    } catch (error) {
      defaultLog.error({ label: 'findCartWithFeaturesById', message: 'Error fetching cart', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
