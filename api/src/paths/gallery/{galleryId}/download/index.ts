import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { AddGalleryDownloadRequestBody } from '../../../../models/gallery-download';
import {
  AddGalleryDownloadRequestSchema,
  GalleryDownloadListResponseSchema
} from '../../../../openapi/schemas/gallery-download';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { GalleryDownloadService } from '../../../../services/gallery/gallery-download-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/gallery/{galleryId}/download');

export const GET: Operation = [getGalleryDownloads()];

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  addDownloadToGallery()
];

GET.apiDoc = {
  description: 'Get gallery download records.',
  tags: ['gallery'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'galleryId',
      required: true,
      schema: { type: 'integer' },
      description: 'Gallery ID.'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Paginated gallery download records',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['downloads', 'pagination'],
            properties: {
              downloads: GalleryDownloadListResponseSchema,
              pagination: paginationResponseSchema
            }
          }
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
 * Get gallery download records.
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

      const galleryDownloadService = new GalleryDownloadService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      const { downloads, count } = await galleryDownloadService.getGalleryDownloads(galleryId, pagination);

      await connection.commit();

      return res.status(200).json({ downloads, pagination: makePaginationResponse(count, pagination) });
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
    const connection = getDBConnection(req.keycloak_token);

    try {
      const galleryId = Number(req.params.galleryId);

      await connection.open();

      const body = req.body as AddGalleryDownloadRequestBody;
      const galleryDownloadService = new GalleryDownloadService(connection);
      await galleryDownloadService.addDownloadToGallery(galleryId, body.downloadId, body.sort ?? null);

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
