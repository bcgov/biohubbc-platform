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
    'submissionUploadId',
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
      type: 'string',
      format: 'uuid',
      description: 'UUID of the submission (globally unique identifier).'
    },
    submissionUploadId: {
      type: 'string',
      format: 'uuid',
      description: 'Primary key of the submission_upload record.'
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

/**
 * Request body for creating a submission upload (POST /submission/:submissionId/upload)
 */
export const SubmissionUploadRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['bytes'],
  properties: {
    bytes: {
      type: 'integer',
      minimum: 1,
      maximum: 1073741824,
      description: 'The expected size of the file to be uploaded in bytes (max 1 GB).'
    },
    name: {
      type: 'string',
      description: 'Name of the submission.'
    },
    description: {
      type: 'string',
      description: 'Description of the submission.'
    },
    comment: {
      type: 'string',
      description: 'Comments for system administrators about the submission.'
    }
  }
};

/**
 * Response for updating a submission upload review status (PATCH /administrative/...)
 */
export const SubmissionUploadReviewStatusResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['submission_upload_status_id', 'submission_upload_id', 'status'],
  properties: {
    submission_upload_status_id: {
      type: 'integer',
      description: 'Primary key of the submission_upload_status record.'
    },
    submission_upload_id: {
      type: 'string',
      format: 'uuid',
      description: 'Foreign key to the submission_upload record.'
    },
    status: {
      type: 'string',
      enum: ['submitted', 'approved', 'denied', 'deleted'],
      description: 'The review status of the submission upload.'
    }
  }
};

/**
 * Response for GET /submission/{submissionId}/history (publish history from submission_upload_status).
 */
export const SubmissionUploadStatusHistoryItemSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['submissionUploadId', 'status'],
  properties: {
    submissionUploadId: {
      type: 'string',
      format: 'uuid',
      description: 'UUID of the submission_upload record.'
    },
    status: {
      type: 'string',
      enum: ['submitted', 'approved', 'denied', 'deleted'],
      description: 'Review status of the submission upload at this point in history.'
    },
    createDate: {
      type: 'string',
      format: 'date-time',
      description: 'When this status record was created.'
    }
  }
};

export const SubmissionUploadStatusHistoryResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  description: 'Publish history for the submission, newest first.',
  required: ['submissionId', 'history'],
  properties: {
    submissionId: {
      type: 'integer',
      minimum: 1,
      description: 'Primary key of the submission record (submission_id).'
    },
    history: {
      type: 'array',
      items: SubmissionUploadStatusHistoryItemSchema
    }
  },
  additionalProperties: false
};

/**
 * Request body for updating a submission upload review status
 */
export const UpdateSubmissionUploadReviewStatusRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: {
      type: 'string',
      enum: ['approved', 'denied'],
      description: 'The new review status for the submission upload.'
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
