import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

export const AdministrativeContributorCodesetSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'contributor_codeset_id',
    'contributor_id',
    'key',
    'label',
    'description',
    'external_id',
    'record_end_date'
  ],
  properties: {
    contributor_codeset_id: { type: 'integer' },
    contributor_id: { type: 'integer' },
    key: { type: 'string' },
    label: { type: 'string' },
    description: { type: 'string', nullable: true },
    external_id: { type: 'string', nullable: true },
    record_end_date: { type: 'string', nullable: true }
  }
};
export const AdministrativeContributorCodesetsSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['codesets', 'pagination'],
  properties: {
    codesets: { type: 'array', items: AdministrativeContributorCodesetSchema },
    pagination: paginationResponseSchema
  }
};
export const AdministrativeContributorCodesetCodeSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'contributor_codeset_code_id',
    'contributor_codeset_id',
    'codeset_label',
    'key',
    'label',
    'description',
    'external_id',
    'record_end_date'
  ],
  properties: {
    contributor_codeset_code_id: { type: 'integer' },
    contributor_codeset_id: { type: 'integer' },
    codeset_label: { type: 'string' },
    key: { type: 'string' },
    label: { type: 'string' },
    description: { type: 'string', nullable: true },
    external_id: { type: 'string', nullable: true },
    record_end_date: { type: 'string', nullable: true }
  }
};
export const AdministrativeContributorCodesetCodesSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['codes', 'pagination'],
  properties: {
    codes: { type: 'array', items: AdministrativeContributorCodesetCodeSchema },
    pagination: paginationResponseSchema
  }
};
export const ContributorCodesetListParameters: OpenAPIV3.ParameterObject[] = [
  { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
  { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
  { in: 'query', name: 'sort', schema: { type: 'string', enum: ['key', 'label', 'external_id', 'record_end_date'] } },
  { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } }
];
