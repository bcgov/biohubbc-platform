import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../../database/db';
import { GalleryDownloadTileListResponseSchema } from '../../../../../openapi/schemas/gallery-download';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../../openapi/schemas/pagination';
import { GalleryDownloadService } from '../../../../../services/gallery/gallery-download-service';
import { getLogger } from '../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/gallery/slug/{slug}/download');

export const GET: Operation = [getPublicGalleryDownloadsBySlug()];

GET.apiDoc = {
  description: 'Get the publicly advertisable download tiles for a slug-addressed gallery.',
  tags: ['gallery'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'slug',
      required: true,
      schema: { type: 'string' },
      description: 'Gallery slug.'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Paginated gallery download tile records',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['downloads', 'pagination'],
            properties: {
              downloads: GalleryDownloadTileListResponseSchema,
              pagination: paginationResponseSchema
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get the publicly advertisable download tiles for a slug-addressed gallery.
 *
 * Public: the landing page addresses its curated gallery by slug (stable across
 * environments, unlike ids), so an unauthenticated caller reads on the shared
 * API-user connection. The service enforces the visibility gate — private and
 * missing galleries are both a 404.
 *
 * @returns {RequestHandler}
 */
export function getPublicGalleryDownloadsBySlug(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      const slug = req.params.slug;

      await connection.open();

      const galleryDownloadService = new GalleryDownloadService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      const { downloads, count } = await galleryDownloadService.getPublicGalleryDownloadsBySlug(slug, pagination);

      await connection.commit();

      return res.status(200).json({ downloads, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getPublicGalleryDownloadsBySlug', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
