import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import { AddGalleryDownloadRequestBody } from '../../../../models/gallery';
import {
  AddGalleryDownloadRequestSchema,
  GalleryDownloadListResponseSchema
} from '../../../../openapi/schemas/gallery';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { GalleryService } from '../../../../services/gallery/gallery-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/gallery/{galleryId}/download');

export const GET: Operation = [getGalleryDownloads()];

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  addDownloadToGallery()
];

GET.apiDoc = {
  description: "Get a gallery's download members, each with its exports attached.",
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
      description: 'Array of gallery download members, each with its exports',
      content: {
        'application/json': {
          schema: GalleryDownloadListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

POST.apiDoc = {
  description: 'Add a download to a gallery.',
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
        schema: AddGalleryDownloadRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Download added to gallery'
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a gallery's download members, each with its exports attached.
 *
 * Public: a gallery is a public-facing curated collection, so an unauthenticated
 * caller can read its contents on the shared API-user connection.
 *
 * @returns {RequestHandler}
 */
export function getGalleryDownloads(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      const galleryId = Number(req.params.galleryId);

      await connection.open();

      const galleryService = new GalleryService(connection);
      const downloads = await galleryService.getGalleryDownloads(galleryId);

      await connection.commit();

      return res.status(200).json(downloads);
    } catch (error) {
      defaultLog.error({ label: 'getGalleryDownloads', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Add a download to a gallery.
 *
 * @returns {RequestHandler}
 */
export function addDownloadToGallery(): RequestHandler {
  return async (req, res) => {
    const parseResult = AddGalleryDownloadRequestBody.safeParse(req.body);
    if (!parseResult.success) {
      throw new HTTP400('Invalid request body', parseResult.error.issues);
    }

    const connection = getDBConnection(req.keycloak_token);

    try {
      const galleryId = Number(req.params.galleryId);

      await connection.open();

      const galleryService = new GalleryService(connection);
      await galleryService.addDownloadToGallery(galleryId, parseResult.data.downloadId, parseResult.data.sort ?? null);

      await connection.commit();

      return res.status(201).send();
    } catch (error) {
      defaultLog.error({ label: 'addDownloadToGallery', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
