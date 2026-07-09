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
  description:
    'Get the publicly advertisable download tiles for a slug-addressed gallery. The landing order (curator pins first, then newest memberships) is a product invariant — client `sort`/`order` params are ignored.',
  tags: ['gallery'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'slug',
      required: true,
      schema: { type: 'string', maxLength: 100 },
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
      // Landing order is a product invariant (curator pins + newest memberships), so a
      // client `sort`/`order` is never applied — strip it here so the pagination
      // response doesn't echo a sort the read didn't honor.
      const pagination = { ...makePaginationOptionsFromRequest(req), sort: undefined, order: undefined };
      const { downloads, count } = await galleryDownloadService.getPublicGalleryDownloadsBySlug(slug, pagination);

      await connection.commit();

      res.setHeader('Cache-Control', 'public, max-age=90');

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
