import { OpenAPIV3 } from 'openapi-types';

export const CreateCodesetSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['categories'],
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'codes', 'description'],
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
              properties: {
                label: {
                  type: 'string',
                  description: 'The label of the code value in the contributing system.'
                },
                value: {
                  type: 'number',
                  description: 'The value for the code referenced in the data.'
                },
                description: {
                  type: 'string',
                  description: 'A human-readable description of the code.',
                  nullable: true
                }
              },
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};
