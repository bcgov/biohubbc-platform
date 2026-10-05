import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

export const ContributorInputSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['clientId', 'description'],
  properties: {
    clientId: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', nullable: true, maxLength: 1000 }
  }
};
export const AdministrativeContributorSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['contributor_id', 'client_id', 'description', 'record_end_date'],
  properties: {
    contributor_id: { type: 'integer' },
    client_id: { type: 'string' },
    description: { type: 'string', nullable: true },
    record_end_date: { type: 'string', nullable: true }
  }
};
export const AdministrativeContributorsSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['contributors', 'pagination'],
  properties: {
    contributors: { type: 'array', items: AdministrativeContributorSchema },
    pagination: paginationResponseSchema
  }
};
export const ContributorListParameters: OpenAPIV3.ParameterObject[] = [
  { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
  { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
  {
    in: 'query',
    name: 'sort',
    schema: { type: 'string', enum: ['contributor_id', 'client_id', 'description', 'record_end_date'] }
  },
  { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
  { in: 'query', name: 'keyword', schema: { type: 'string' } },
  { in: 'query', name: 'active_only', schema: { type: 'boolean' } }
];
