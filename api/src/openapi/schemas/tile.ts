import { OpenAPIV3 } from 'openapi-types';

/**
 * Response returned when a tile session is created.
 */
export const tileTokenResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['token', 'token_type', 'token_expires_in', 'source', 'tile_url_template'],
  properties: {
    token: {
      type: 'string',
      description: 'Short lived RS256 tile token. Attach as a Bearer token on tile requests.'
    },
    token_type: {
      type: 'string',
      enum: ['Bearer']
    },
    token_expires_in: {
      type: 'integer',
      description: 'Token lifetime in seconds. Re-request a session before this elapses.'
    },
    source: {
      type: 'string',
      description: 'The tile source this token grants access to.'
    },
    tile_url_template: {
      type: 'string',
      description: 'Tile URL template for MapLibre, e.g. "/tiles/{source}/{z}/{x}/{y}".'
    }
  },
  additionalProperties: false
};
