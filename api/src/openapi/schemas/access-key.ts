import { OpenAPIV3 } from 'openapi-types';

/**
 * OpenAPI schema for a public access key record (no key_hash).
 */
export const AccessKeyViewSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'access_key_id',
    'system_user_id',
    'name',
    'key_prefix',
    'expires_at',
    'revoked_at',
    'last_used_at',
    'record_end_date',
    'create_date',
    'create_user',
    'update_date',
    'update_user',
    'revision_count'
  ],
  additionalProperties: false,
  properties: {
    access_key_id: {
      type: 'string',
      format: 'uuid',
      description: 'System generated surrogate primary key identifier.'
    },
    system_user_id: {
      type: 'integer',
      minimum: 1,
      description: 'ID of the system user who owns this key.'
    },
    name: {
      type: 'string',
      description: 'Human-readable label for the key.'
    },
    key_prefix: {
      type: 'string',
      description: 'Short plaintext prefix of the key used for display and identification.'
    },
    expires_at: {
      type: 'string',
      description: 'ISO 8601 timestamp after which the key is no longer valid.'
    },
    revoked_at: {
      type: 'string',
      nullable: true,
      description: 'ISO 8601 timestamp at which the key was revoked; null if still active.'
    },
    last_used_at: {
      type: 'string',
      nullable: true,
      description: 'ISO 8601 timestamp of the most recent successful authentication using this key.'
    },
    record_end_date: {
      type: 'string',
      nullable: true,
      description: 'Soft-delete timestamp; null when the record is active.'
    },
    create_date: {
      type: 'string',
      description: 'The datetime the record was created.'
    },
    create_user: {
      type: 'integer',
      minimum: 1,
      description: 'The id of the user who created the record.'
    },
    update_date: {
      type: 'string',
      nullable: true,
      description: 'The datetime the record was last updated.'
    },
    update_user: {
      type: 'integer',
      nullable: true,
      description: 'The id of the user who last updated the record.'
    },
    revision_count: {
      type: 'integer',
      minimum: 0,
      description: 'Revision count used for concurrency control.'
    }
  }
};

/**
 * OpenAPI schema for the response body when a new access key is created.
 * The `plaintext_key` field is present only in this response and must be saved by the caller immediately.
 */
export const CreateAccessKeyResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['access_key', 'plaintext_key'],
  additionalProperties: false,
  properties: {
    access_key: AccessKeyViewSchema,
    plaintext_key: {
      type: 'string',
      description: 'The full plaintext API key. This is shown exactly once and cannot be recovered.'
    }
  }
};
