import { OpenAPIV3 } from 'openapi-types';

export const CreateSubmissionUploadRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['bytes', 'name', 'description', 'comment'],
  properties: {
    bytes: {
      type: 'integer',
      minimum: 1,
      maximum: 1073741824,
      description: 'The expected size of the file to be uploaded in bytes (max 1 GB).'
    },
    name: {
      type: 'string',
      description: 'Name of the submission'
    },
    description: {
      type: 'string',
      description: 'Description of the submission'
    },
    comment: {
      type: 'string',
      description: 'Comments for system administrators about the submission'
    }
  }
};

export const CreateSubmissionUploadResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'submissionId',
    'uploadId',
    's3UploadId',
    'uploadArchiveId',
    'key',
    'partSizeBytes',
    'partCount',
    'presignedUrls'
  ],
  properties: {
    submissionId: {
      type: 'number',
      description: 'Primary key of the submission'
    },
    uploadId: {
      type: 'string',
      format: 'uuid',
      description: 'Internal upload identifier.'
    },
    s3UploadId: {
      type: 'string',
      description: 'AWS S3 multipart upload ID.'
    },
    uploadArchiveId: {
      type: 'string',
      description: 'ID for the upload archive record.'
    },
    key: {
      type: 'string',
      description: 'S3 object key where the upload will be stored.'
    },
    partSizeBytes: {
      type: 'integer',
      minimum: 1,
      description: 'Size of each multipart upload chunk in bytes.'
    },
    partCount: {
      type: 'integer',
      minimum: 1,
      description: 'Total number of parts required to upload the file.'
    },
    presignedUrls: {
      type: 'array',
      description: 'Presigned URLs for multipart upload.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['partNumber', 'url'],
        properties: {
          partNumber: {
            type: 'integer',
            minimum: 1
          },
          url: {
            type: 'string',
            format: 'uri'
          }
        }
      }
    }
  }
};

export const CompleteMultipartUploadRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['s3UploadId', 'key', 'parts'],
  properties: {
    s3UploadId: {
      type: 'string',
      description: 'The s3 upload ID of the upload session.'
    },
    key: {
      type: 'string',
      description: 'The S3 object key used during multipart upload.'
    },
    parts: {
      type: 'array',
      description: 'List of uploaded parts and their corresponding ETags.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['PartNumber', 'ETag'],
        properties: {
          PartNumber: {
            type: 'integer',
            minimum: 1,
            description: 'Part number of the uploaded chunk.'
          },
          ETag: {
            type: 'string',
            description: 'ETag returned by S3 for the uploaded part.'
          }
        }
      }
    }
  }
};
