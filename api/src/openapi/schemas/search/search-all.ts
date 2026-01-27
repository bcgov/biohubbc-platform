import { OpenAPIV3 } from 'openapi-types';
import { paginatedDataSchema } from './search';

/**
 * Simplified schemas
 */
const featureSimpleSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['submission_feature_id', 'feature_type_id', 'label'],
  properties: {
    submission_feature_id: { type: 'integer' },
    feature_type_id: { type: 'integer' },
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

const taxonomySchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['taxon_id', 'itis_scientific_name'],
  properties: {
    taxon_id: { type: 'integer' },
    itis_scientific_name: { type: 'string' }
  }
};

export const searchAllResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['features', 'submissions', 'taxonomy'],
  properties: {
    features: paginatedDataSchema(featureSimpleSchema),
    submissions: paginatedDataSchema(submissionSchema),
    taxonomy: paginatedDataSchema(taxonomySchema)
  }
};
