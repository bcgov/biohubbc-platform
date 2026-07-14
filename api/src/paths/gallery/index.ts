import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection } from '../../database/db';
import { CreateGalleryRequestBody } from '../../models/gallery';
import {
  CreateGalleryRequestSchema,
  GalleryListResponseSchema,
  GalleryResponseSchema
} from '../../openapi/schemas/gallery';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { GalleryService } from '../../services/gallery/gallery-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/gallery');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getGalleries()
];

GET.apiDoc = {
  description: 'Get all active galleries.',
  tags: ['gallery'],
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'List of active galleries',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['galleries'],
            properties: {
              galleries: GalleryListResponseSchema
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all active galleries.
 *
 * @returns {RequestHandler}
 */
export function getGalleries(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const galleryService = new GalleryService(connection);
      const galleries = await galleryService.getGalleries();

      await connection.commit();

      return res.status(200).json({ galleries });
    } catch (error) {
      defaultLog.error({ label: 'getGalleries', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createGallery()
];

POST.apiDoc = {
  description: 'Create a gallery.',
  tags: ['gallery'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateGalleryRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Gallery created',
      content: {
        'application/json': {
          schema: GalleryResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a gallery.
 *
 * @returns {RequestHandler}
 */
export function createGallery(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const galleryService = new GalleryService(connection);
      const gallery = await galleryService.createGallery(req.body as CreateGalleryRequestBody);

      await connection.commit();

      return res.status(201).json(gallery);
    } catch (error) {
      defaultLog.error({ label: 'createGallery', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
