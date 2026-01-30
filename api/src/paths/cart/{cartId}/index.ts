import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { GetCartWithFeaturesSchema } from '../../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { CartService } from '../../../services/cart-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/cart/{cartId}');

export const GET: Operation = [findCartWithFeaturesById()];

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
 * GET cart by cartId
 *
 * @returns {RequestHandler}
 */
export function findCartWithFeaturesById(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

      const cartId = req.params.cartId;
      const cartService = new CartService(connection);

      const cart = await cartService.findCartWithFeaturesById(cartId, systemUserId);

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
