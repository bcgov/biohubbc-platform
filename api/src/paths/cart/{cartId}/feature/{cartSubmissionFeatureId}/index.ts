import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { CartSubmissionFeatureService } from '../../../../../services/cart-submission-feature-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/cart/{cartId}/feature/{cartSubmissionFeatureId}');

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
    }
  ],
  responses: {
    200: {
      description: 'Cart feature deleted successfully'
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

      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      await cartSubmissionFeatureService.removeSubmissionFeaturesFromCart(cartId, [cartSubmissionFeatureId]);

      await connection.commit();

      res.status(200).json();
    } catch (error) {
      defaultLog.error({ label: 'deleteCartSubmissionFeature', message: 'Error deleting cart feature', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
