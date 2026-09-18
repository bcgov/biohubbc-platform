import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import {
  MARTIN_SOURCE,
  MARTIN_UPLOAD_MAX_ZOOM,
  MARTIN_UPLOAD_MIN_ZOOM,
  MARTIN_UPLOAD_SOURCE_LAYER
} from '../../../../../../../constants/martin';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import { martinExtentSessionResponseSchema } from '../../../../../../../openapi/schemas/martin';
import { martinTokenRateLimiter } from '../../../../../../../request-handlers/rate-limit';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { MartinTokenService } from '../../../../../../../services/martin-token-service';
import { SubmissionFeaturePropertyGeometryService } from '../../../../../../../services/submission-feature-property-geometry-service';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/tile');

export const POST: Operation = [
  martinTokenRateLimiter,
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createSubmissionUploadTileSession()
];

POST.apiDoc = {
  description: 'Create a tile session for the spatial properties of the active features of a submission upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission ID',
      in: 'path',
      name: 'submissionId',
      schema: { type: 'integer', minimum: 1 },
      required: true
    },
    {
      description: 'Submission Upload ID',
      in: 'path',
      name: 'submissionUploadId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'A tile session, or a statement that the upload has no spatial properties to map.',
      content: {
        'application/json': { schema: martinExtentSessionResponseSchema }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a tile session for every active feature of one submission upload.
 *
 * Follows the single-feature tile route rather than the search one: the token is scoped by
 * construction, its `ctx` claim carrying the submission and upload identifiers directly, and no
 * server-side context row is created. The route is restricted to system administrators, and the
 * upload is looked up by both identifiers before anything else happens, so a pair that does not match
 * is a 404 rather than an empty map — and a token is never minted for an upload the caller did not
 * name together with its submission.
 *
 * Serve time security is deliberately weaker than for search because there is nothing left to
 * protect: an administrator can already read every one of these geometries in full through the
 * upload feature properties endpoint. What `biohub.martin_upload` still enforces is the shape of the
 * request — the upload must belong to the submission in the same token, and only features that have
 * not been ended are drawn.
 *
 * This returns only what is needed to initialize a map. Geometry values are not included: they reach
 * the browser as vector tiles served by the Martin Gateway, so tile bytes never pass through this API.
 *
 * @returns {RequestHandler}
 */
export function createSubmissionUploadTileSession(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();

      // Ownership first: throws ApiNotFoundError when the upload is not this submission's, or has
      // been soft deleted. Nothing below runs for a mismatched pair.
      const uploadService = new SubmissionUploadService(connection);
      const upload = await uploadService.getSubmissionUploadBySubmissionId(submissionId, req.params.submissionUploadId);

      // Extent under the same active-feature predicate the tile function applies.
      const geometryService = new SubmissionFeaturePropertyGeometryService(connection);
      const extent = await geometryService.getSubmissionUploadGeometryExtent(submissionId, upload.submission_upload_id);

      await connection.commit();

      // The token is short lived and caller specific, so it must never be cached.
      res.setHeader('Cache-Control', 'no-store');

      if (!extent.bbox) {
        // Nothing to draw, so nothing to authorize. Issuing a token here would hand out a credential
        // whose only possible use is fetching empty tiles.
        return res.status(200).json({ has_spatial_properties: false });
      }

      const tokenService = new MartinTokenService();

      const { token, expiresIn } = tokenService.mintToken({
        source: MARTIN_SOURCE.UPLOAD,
        // Parsed back out by biohub.martin_upload. Built from the stored upload id rather than the
        // path parameter, so a non-canonical spelling in the URL cannot vary the context string.
        ctx: `su:${submissionId}:${upload.submission_upload_id}`
      });

      return res.status(200).json({
        has_spatial_properties: true,
        token,
        token_type: 'Bearer',
        token_expires_in: expiresIn,
        source: MARTIN_SOURCE.UPLOAD,
        source_layer: MARTIN_UPLOAD_SOURCE_LAYER,
        martin_url_template: tokenService.getMartinUrlTemplate(MARTIN_SOURCE.UPLOAD),
        bbox: extent.bbox,
        min_zoom: MARTIN_UPLOAD_MIN_ZOOM,
        max_zoom: MARTIN_UPLOAD_MAX_ZOOM
      });
    } catch (error) {
      defaultLog.error({ label: 'createSubmissionUploadTileSession', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
