import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { CartSubmissionFeatureService } from '../../../../../services/cart-submission-feature-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/cart/{cartId}/feature/{cartSubmissionFeatureId}');

export const DELETE: Operation = [deleteCartSubmissionFeature()];

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
      schema: { type: 'integer' },
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
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

      const cartId = req.params.cartId;
      const cartSubmissionFeatureId = req.params.cartSubmissionFeatureId;

      const cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);

      await cartSubmissionFeatureService.removeSubmissionFeaturesFromCart(cartId, systemUserId, [
        cartSubmissionFeatureId
      ]);

      await connection.commit();

      res.status(200).json({ message: 'Feature removed from cart successfully' });
    } catch (error) {
      defaultLog.error({ label: 'deleteCartSubmissionFeature', message: 'Error deleting cart feature', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
