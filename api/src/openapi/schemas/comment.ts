import { OpenAPIV3 } from 'openapi-types';

export const CommentResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['comment', 'comment_id'],
  additionalProperties: false,
  properties: {
    comment_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the comment'
    },
    comment: {
      type: 'string',
      description: 'The comment text content'
    }
  }
};
