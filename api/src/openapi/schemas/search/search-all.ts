import { OpenAPIV3 } from 'openapi-types';
import { paginatedDataSchema } from './search';
import { taxonResultSchema } from './search-taxon';

/**
 * Simplified schemas
 */
const featureSimpleSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['submission_feature_id', 'feature_type_id', 'feature_type_name', 'label'],
  properties: {
    submission_feature_id: { type: 'integer' },
    feature_type_id: { type: 'integer' },
    feature_type_name: { type: 'string' },
    label: { type: 'string' }
  }
};

const submissionSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['submission_id', 'name'],
  properties: {
    submission_id: { type: 'integer' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true }
  }
};

export const searchAllResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['features', 'submissions', 'taxonomy'],
  properties: {
    features: paginatedDataSchema(featureSimpleSchema),
    submissions: paginatedDataSchema(submissionSchema),
    taxonomy: paginatedDataSchema(taxonResultSchema)
  }
};
