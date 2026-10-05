import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

export const ContributorSystemUserInputSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['contributorId', 'systemUserId'],
  properties: { contributorId: { type: 'integer', minimum: 1 }, systemUserId: { type: 'integer', minimum: 1 } }
};
export const AdministrativeContributorSystemUserSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'contributor_system_user_id',
    'contributor_id',
    'system_user_id',
    'client_id',
    'user_identifier',
    'display_name',
    'record_end_date'
  ],
  properties: {
    contributor_system_user_id: { type: 'integer' },
    contributor_id: { type: 'integer' },
    system_user_id: { type: 'integer' },
    client_id: { type: 'string' },
    user_identifier: { type: 'string' },
    display_name: { type: 'string', nullable: true },
    record_end_date: { type: 'string', nullable: true }
  }
};
export const AdministrativeContributorSystemUsersSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['contributor_users', 'pagination'],
  properties: {
    contributor_users: { type: 'array', items: AdministrativeContributorSystemUserSchema },
    pagination: paginationResponseSchema
  }
};
export const ContributorSystemUserListParameters: OpenAPIV3.ParameterObject[] = [
  { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
  { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
  {
    in: 'query',
    name: 'sort',
    schema: { type: 'string', enum: ['contributor_system_user_id', 'client_id', 'user_identifier', 'record_end_date'] }
  },
  { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
  { in: 'query', name: 'keyword', schema: { type: 'string' } },
  { in: 'query', name: 'active_only', schema: { type: 'boolean' } },
  { in: 'query', name: 'contributor_id', schema: { type: 'integer', minimum: 1 } }
];
