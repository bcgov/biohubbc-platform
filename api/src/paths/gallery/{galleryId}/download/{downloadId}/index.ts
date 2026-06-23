import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { GalleryDownloadService } from '../../../../../services/gallery/gallery-download-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/gallery/{galleryId}/download/{downloadId}');

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  removeDownloadFromGallery()
];

DELETE.apiDoc = {
  description: 'Remove a download from a gallery.',
  tags: ['gallery'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'galleryId',
      required: true,
      schema: { type: 'integer' },
      description: 'Gallery ID.'
    },
    {
      in: 'path',
      name: 'downloadId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Download UUID.'
    }
  ],
  responses: {
    204: {
      description: 'Download removed from gallery'
    },
    ...defaultErrorResponses
  }
};

/**
 * Remove a download from a gallery.
 *
 * @returns {RequestHandler}
 */
export function removeDownloadFromGallery(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      const galleryId = Number(req.params.galleryId);
      const downloadId = req.params.downloadId;

      await connection.open();

      const galleryDownloadService = new GalleryDownloadService(connection);
      await galleryDownloadService.removeDownloadFromGallery(galleryId, downloadId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'removeDownloadFromGallery', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
