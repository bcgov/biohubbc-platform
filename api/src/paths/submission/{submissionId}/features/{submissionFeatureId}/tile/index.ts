import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { martinFeatureSessionResponseSchema } from '../../../../../../openapi/schemas/martin';
import { martinTokenRateLimiter } from '../../../../../../request-handlers/rate-limit';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { MartinTokenService } from '../../../../../../services/martin-token-service';
import { SubmissionFeaturePropertyGeometryService } from '../../../../../../services/submission-feature-property-geometry-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}/features/{submissionFeatureId}/tile');

/** Martin source serving one submission feature's spatial properties. */
const MARTIN_SOURCE = 'feature';

/** Layer name `biohub.martin_feature` encodes into its tiles. */
const MARTIN_SOURCE_LAYER = 'geometries';

/** Zoom range the `feature` source is published at. Keep in sync with the Martin function source config. */
const MARTIN_SOURCE_MIN_ZOOM = 0;
const MARTIN_SOURCE_MAX_ZOOM = 15;

export const POST: Operation = [
  martinTokenRateLimiter,
  // The same rule the feature detail endpoint uses, so a caller who can read the feature can map it,
  // and nobody else can. Unsecured features resolve for anonymous callers.
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Policy',
          submissionFeatureId: Number(req.params.submissionFeatureId),
          submissionId: Number(req.params.submissionId)
        }
      ]
    };
  }),
  createSubmissionFeatureTileSession()
];

POST.apiDoc = {
  description: "Create a tile session for a submission feature's spatial properties.",
  tags: ['tile'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'Submission ID.',
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    },
    {
      description: 'Submission Feature ID.',
      in: 'path',
      name: 'submissionFeatureId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'A tile session, or a statement that the feature has no spatial properties to map.',
      content: {
        'application/json': { schema: martinFeatureSessionResponseSchema }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a tile session for a single submission feature.
 *
 * The token is scoped by construction rather than by validation: its `ctx` claim is built from the
 * two path parameters the authorization rule above just approved. A client that asks for a feature it
 * cannot read never reaches this handler, and a client that edits the identifiers is simply asking for
 * a different feature, which is authorized on its own merits. There is no client supplied input that
 * the token widens.
 *
 * This returns only what is needed to initialize a map. Geometry values are not included: they reach
 * the browser as vector tiles served by the Martin Gateway, so tile bytes never pass through this API.
 *
 * @returns {RequestHandler}
 */
export function createSubmissionFeatureTileSession(): RequestHandler {
  return async (req, res) => {
    // Unsecured features are readable anonymously (see the closure-based authorization rule on this
    // route); fall back to the API user connection when there is no keycloak token, mirroring the
    // feature detail endpoint.
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();
    const submissionId = Number(req.params.submissionId);
    const submissionFeatureId = Number(req.params.submissionFeatureId);

    try {
      await connection.open();

      const geometryService = new SubmissionFeaturePropertyGeometryService(connection);
      const extent = await geometryService.getActiveGeometryExtent(submissionId, submissionFeatureId);

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
        source: MARTIN_SOURCE,
        // Parsed back out by biohub.martin_feature. Carrying the identifiers in the signed token,
        // rather than letting the client send them, is what makes them trustworthy at serve time.
        ctx: `sf:${submissionId}:${submissionFeatureId}`
      });

      return res.status(200).json({
        has_spatial_properties: true,
        token,
        token_type: 'Bearer',
        token_expires_in: expiresIn,
        source: MARTIN_SOURCE,
        source_layer: MARTIN_SOURCE_LAYER,
        martin_url_template: tokenService.getMartinUrlTemplate(MARTIN_SOURCE),
        bbox: extent.bbox,
        min_zoom: MARTIN_SOURCE_MIN_ZOOM,
        max_zoom: MARTIN_SOURCE_MAX_ZOOM
      });
    } catch (error) {
      defaultLog.error({ label: 'createSubmissionFeatureTileSession', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
