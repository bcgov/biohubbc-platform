import { OpenAPIV3 } from 'openapi-types';
import { ReconciliationType } from '../../models/reconciliation';
import { cursorPaginationResponseSchema } from './pagination';
import { featureSearchPropertySchema, featureSearchResultSchema } from './search/search-feature';
import { submissionUploadParameters } from './submission-upload';

export const reconciliationFeatureParameters: OpenAPIV3.ParameterObject[] = [
  ...submissionUploadParameters,
  { in: 'path', name: 'reconciliation', required: true, schema: { type: 'string', enum: ReconciliationType.options } }
];

export const reconciliationFeaturePageSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['features', 'properties', 'pagination'],
  additionalProperties: false,
  properties: {
    features: { type: 'array', items: featureSearchResultSchema },
    properties: { type: 'array', items: featureSearchPropertySchema },
    pagination: cursorPaginationResponseSchema
  }
};

export const reconciliationFeatureCountsSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['total', 'feature_types'],
  additionalProperties: false,
  properties: {
    total: { type: 'integer', minimum: 0 },
    feature_types: {
      type: 'array',
      items: {
        type: 'object',
        required: ['feature_type_name', 'count'],
        additionalProperties: false,
        properties: {
          feature_type_name: { type: 'string' },
          count: { type: 'integer', minimum: 0 }
        }
      }
    }
  }
};
