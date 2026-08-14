import { OpenAPIV3 } from 'openapi-types';
import { featureSearchExpressionTreeSchema } from './search/search-feature';

/**
 * Request body for creating a Martin session.
 */
export const martinSessionRequestBodySchema: OpenAPIV3.RequestBodyObject = {
  description: 'The feature type and search expression the map should show.',
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['feature_type'],
        properties: {
          feature_type: {
            type: 'string',
            description: 'Feature type to map. Must match the type the search results are showing.'
          },
          expression: {
            ...featureSearchExpressionTreeSchema,
            description: 'Search expression. Omit to map an unfiltered view of the feature type.'
          }
        },
        additionalProperties: false
      }
    }
  }
};

/**
 * Response returned when a Martin session is created.
 */
export const martinSessionResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'token',
    'token_type',
    'token_expires_in',
    'context_expires_in',
    'source',
    'martin_url_template',
    'has_more_secured_features'
  ],
  properties: {
    token: {
      type: 'string',
      description: 'Short lived RS256 tile token. Attach as a Bearer token on tile requests.'
    },
    token_type: { type: 'string', enum: ['Bearer'] },
    token_expires_in: {
      type: 'integer',
      description: 'Token lifetime in seconds. Request a new session before this elapses.'
    },
    context_expires_in: {
      type: 'integer',
      description: 'Remaining lifetime of the underlying authorization context, in seconds.'
    },
    source: { type: 'string', description: 'Tile source this token grants access to.' },
    martin_url_template: {
      type: 'string',
      description: 'Tile URL template for MapLibre, e.g. "/martin/search/{z}/{x}/{y}".'
    },
    has_more_secured_features: {
      type: 'boolean',
      description: 'True when the search matched secured features this caller cannot see.'
    }
  },
  additionalProperties: false
};
