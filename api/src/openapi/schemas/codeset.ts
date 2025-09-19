import { OpenAPIV3 } from 'openapi-types';

export const CreateCodesetSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  description: 'Request body for contributing systems to publish codesets',
  required: ['categories'],
  additionalProperties: false,
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'codes', 'description'],
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            description: 'The name of the category (e.g., "sign", "status"), like the key in a key-value pair.'
          },
          description: {
            type: 'string',
            description: 'The description of the category.'
          },
          codes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label', 'value', 'description'],
              additionalProperties: false,
              properties: {
                label: {
                  type: 'string',
                  description: 'The displayed label of the code value in the contributing system (eg. "very hot").'
                },
                value: {
                  type: 'number',
                  description: 'The value for the code referenced in the data (eg. 1, which might encode "very hot").'
                },
                description: {
                  type: 'string',
                  description: 'A human-readable description of the code.',
                  nullable: true
                }
              }
            }
          }
        }
      }
    }
  }
};
