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
