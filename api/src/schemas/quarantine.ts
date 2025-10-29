import { OpenAPIV3 } from 'openapi-types';

export const GetQuarantinedSubmissionsSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['submissions'],
  properties: {
    submissions: {
      required: ['submission_id', 'name', 'description', 'submitted_timestamp', 'quarantine'],
      properties: {
        submission_id: {
          type: 'integer',
          minimum: 1
        },
        name: {
          type: 'string',
          maxLength: 200
        },
        description: {
          type: 'string',
          maxLength: 3000
        },
        submitted_timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp of the submission (when the upload was completed)'
        },
        quarantine: {
          type: 'object',
          required: ['quarantine_id', 'uri', 'status', 'upload_id'],
          properties: {
            quarantine_id: {
              type: 'string',
              format: 'uuid'
            },
            uri: {
              type: 'string',
              maxLength: 200
            },
            status: {
              type: 'string',
              enum: ['pending', 'scanning', 'passed', 'rejected', 'failed']
            },
            upload_id: {
              type: 'string',
              maxLength: 100
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  }
};
