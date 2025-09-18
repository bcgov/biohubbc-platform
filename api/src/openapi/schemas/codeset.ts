import { OpenAPIV3 } from 'openapi-types';

export const CreateCodesetSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['codes'],
  properties: {
    codes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'codes'],
        properties: {
          category: {
            type: 'string',
            description: 'The category of the codes (e.g., "sign", "status").'
          },
          codes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['code_name'],
              properties: {
                code_name: {
                  type: 'string',
                  description: 'The actual code value from the contributor system.'
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
