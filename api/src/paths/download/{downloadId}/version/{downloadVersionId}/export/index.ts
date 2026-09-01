import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../../database/db';
import { DownloadVersionExportListResponseSchema } from '../../../../../../openapi/schemas/download-version-export';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../../openapi/schemas/pagination';
import { DownloadExportService } from '../../../../../../services/download/download-export-service';
import { DownloadService } from '../../../../../../services/download/download-service';
import { getLogger } from '../../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../../utils/pagination';

const defaultLog = getLogger('paths/download/{downloadId}/version/{downloadVersionId}/export');

export const GET: Operation = [listDownloadVersionExports()];

GET.apiDoc = {
  description: 'List exports for a download version, newest first',
  tags: ['download'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'downloadId',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    },
    {
      in: 'path',
      name: 'downloadVersionId',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Paginated exports for the selected version',
      content: { 'application/json': { schema: DownloadVersionExportListResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List exports belonging to the download version identified by the route parameters.
 *
 * @return {RequestHandler} Express handler returning the version's paginated exports.
 */
export function listDownloadVersionExports(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();
      const pagination = makePaginationOptionsFromRequest(req);
      const downloadService = new DownloadService(connection);
      const exportService = new DownloadExportService(connection);

      await downloadService.getDownloadVersion(req.params.downloadId, req.params.downloadVersionId);

      const [exports, count] = await Promise.all([
        exportService.listDownloadVersionExports(req.params.downloadId, pagination, req.params.downloadVersionId),
        exportService.listDownloadVersionExportsCount(req.params.downloadId, req.params.downloadVersionId)
      ]);
      await connection.commit();
      return res.status(200).json({ exports, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'listDownloadVersionExports', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
