import { OpenAPIV3 } from 'openapi-types';
import { paginationRequestBodySchema, paginationResponseSchema } from '../pagination';

export const taxonSearchFiltersSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    keyword: { type: 'string' }
  }
};

export const taxonResultSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['taxon_id', 'itis_tsn', 'itis_scientific_name', 'common_name', 'rank', 'relevancy_score'],
  properties: {
    taxon_id: { type: 'integer' },
    itis_tsn: { type: 'integer' },
    itis_scientific_name: { type: 'string' },
    common_name: { type: 'string', nullable: true },
    rank: { type: 'string', nullable: true },
    relevancy_score: { type: 'number' }
  }
};

export const taxonSearchRequestBodySchema: OpenAPIV3.RequestBodyObject = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['filters'],
        properties: {
          filters: taxonSearchFiltersSchema,
          pagination: paginationRequestBodySchema
        }
      }
    }
  }
};

export const taxonSearchResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['taxonomy', 'pagination'],
  properties: {
    taxonomy: { type: 'array', items: taxonResultSchema },
    pagination: paginationResponseSchema
  }
};
