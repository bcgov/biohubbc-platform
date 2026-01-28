import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../database/db';
import { HTTP500 } from '../../../../../errors/http-error';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { CartDownloadService } from '../../../../../services/cart-download-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/cart/session/{cartId}/download');

export const POST: Operation = [postCartDownload()];

POST.apiDoc = {
  description: 'Generate a download package for a cart',
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
    description: 'Email is required if the user is not logged in',
    required: false,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email to send the download link to (if not logged in)'
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: 'Download created successfully'
    },
    ...defaultErrorResponses
  }
};

/**
 * POST download for cart by cartId
 *
 * @returns {RequestHandler}
 */
export function postCartDownload(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const requestedEmail = req.body.email as string | undefined;

      // Reject if no email is provided, either in the body or through Keycloak
      const email = requestedEmail ?? req.system_user?.email;
      if (!email) {
        throw new HTTP500('Email is required');
      }

      const cartId = req.params.cartId;

      const cartDownloadService = new CartDownloadService(connection);
      await cartDownloadService.submitDownload(cartId, email);

      await connection.commit();

      res.status(201).json();
    } catch (error) {
      defaultLog.error({ label: 'postCartDownload', message: 'Error creating cart download', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
