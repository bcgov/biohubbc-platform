import { OpenAPIV3 } from 'openapi-types';
import { countSchema, countSummaryByTypeSchema } from './search';

export const searchSummaryResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['features', 'submissions', 'taxonomy'],
  properties: {
    features: countSummaryByTypeSchema,
    submissions: countSchema,
    taxonomy: countSchema
  }
};
