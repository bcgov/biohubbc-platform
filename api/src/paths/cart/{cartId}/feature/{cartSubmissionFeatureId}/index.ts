import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../database/db';
import { CartFeaturesResponseSchema, IsFeatureInCartResponseSchema } from '../../../../../openapi/schemas/cart';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { CartSubmissionFeatureService } from '../../../../../services/cart-submission-feature-service';
import { getLogger } from '../../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/cart/{cartId}/feature/{cartSubmissionFeatureId}');

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
  isSubmissionFeatureInCart()
];

GET.apiDoc = {
  description: 'Check if a submission feature is in the cart',
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
    {
      in: 'path',
      name: 'cartSubmissionFeatureId',
      required: true,
      schema: { type: 'integer' },
      description: 'The submission feature ID to check for cart membership'
    }
  ],
  responses: {
    200: {
      description: 'Cart membership check result',
      content: {
        'application/json': {
          schema: IsFeatureInCartResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Check if a submission feature is in the cart
 *
 * @returns {RequestHandler}
 */
export function isSubmissionFeatureInCart(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const cartId = req.params.cartId;
      const submissionFeatureId = Number(req.params.cartSubmissionFeatureId);

      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);
      const isInCart = await cartSubmissionFeatureService.isSubmissionFeatureInCart(cartId, submissionFeatureId);

      await connection.commit();

      return res.status(200).json({ isInCart });
    } catch (error) {
      defaultLog.error({ label: 'isSubmissionFeatureInCart', message: 'Error checking cart membership', error });
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
  deleteCartSubmissionFeature()
];

DELETE.apiDoc = {
  description: 'Delete a specific feature from the cart by cartId and cartSubmissionFeatureId',
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
    {
      in: 'path',
      name: 'cartSubmissionFeatureId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'ID of the submission feature to remove from the cart'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Cart feature deleted successfully',
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
 * DELETE a specific cart submission feature by cartId and cartSubmissionFeatureId
 *
 * @returns {RequestHandler}
 */
export function deleteCartSubmissionFeature(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const cartId = req.params.cartId;
      const cartSubmissionFeatureId = req.params.cartSubmissionFeatureId;
      const pagination = makePaginationOptionsFromRequest(req);

      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      await cartSubmissionFeatureService.removeSubmissionFeaturesFromCart(cartId, [cartSubmissionFeatureId]);
      const response = await cartSubmissionFeatureService.getPaginatedCartFeaturesResponse(cartId, pagination);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'deleteCartSubmissionFeature', message: 'Error deleting cart feature', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
