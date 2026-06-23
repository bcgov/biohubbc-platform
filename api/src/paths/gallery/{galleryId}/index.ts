import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { UpdateGalleryRequestBody } from '../../../models/gallery';
import { CreateGalleryRequestSchema, GalleryResponseSchema } from '../../../openapi/schemas/gallery';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { GalleryService } from '../../../services/gallery/gallery-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/gallery/{galleryId}');

export const GET: Operation = [getGalleryById()];

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateGallery()
];

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteGallery()
];

GET.apiDoc = {
  description: 'Get a gallery by ID.',
  tags: ['gallery'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'galleryId',
      required: true,
      schema: { type: 'integer' },
      description: 'Gallery ID.'
    }
  ],
  responses: {
    200: {
      description: 'Gallery details',
      content: {
        'application/json': {
          schema: GalleryResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

PUT.apiDoc = {
  description: "Update a gallery's name and description.",
  tags: ['gallery'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'galleryId',
      required: true,
      schema: { type: 'integer' },
      description: 'Gallery ID.'
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateGalleryRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Gallery updated',
      content: {
        'application/json': {
          schema: GalleryResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

DELETE.apiDoc = {
  description: 'Delete a gallery by ID.',
  tags: ['gallery'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'galleryId',
      required: true,
      schema: { type: 'integer' },
      description: 'Gallery ID.'
    }
  ],
  responses: {
    204: {
      description: 'Gallery deleted'
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a gallery by ID.
 *
 * Public: the gallery is a public-facing curated collection, so an unauthenticated
 * caller can read it on the shared API-user connection.
 *
 * @returns {RequestHandler}
 */
export function getGalleryById(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      const galleryId = Number(req.params.galleryId);

      await connection.open();

      const galleryService = new GalleryService(connection);
      // Public read: scope to public galleries so a private gallery surfaces as a 404.
      const gallery = await galleryService.getGalleryById(galleryId, true);

      await connection.commit();

      return res.status(200).json(gallery);
    } catch (error) {
      defaultLog.error({ label: 'getGalleryById', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Update a gallery's name and description.
 *
 * @returns {RequestHandler}
 */
export function updateGallery(): RequestHandler {
  return async (req, res) => {
    const parseResult = UpdateGalleryRequestBody.safeParse(req.body);
    if (!parseResult.success) {
      throw new HTTP400('Invalid request body', parseResult.error.issues);
    }

    const connection = getDBConnection(req.keycloak_token);

    try {
      const galleryId = Number(req.params.galleryId);

      await connection.open();

      const galleryService = new GalleryService(connection);
      const gallery = await galleryService.updateGallery(galleryId, parseResult.data);

      await connection.commit();

      return res.status(200).json(gallery);
    } catch (error) {
      defaultLog.error({ label: 'updateGallery', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Soft-delete a gallery by ID.
 *
 * @returns {RequestHandler}
 */
export function deleteGallery(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      const galleryId = Number(req.params.galleryId);

      await connection.open();

      const galleryService = new GalleryService(connection);
      await galleryService.deleteGallery(galleryId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteGallery', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
