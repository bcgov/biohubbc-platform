import { OpenAPIV3 } from 'openapi-types';

export const CreateSubmissionUploadRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['bytes', 'name', 'description', 'comment'],
  properties: {
    bytes: {
      type: 'integer',
      minimum: 1,
      maximum: 10737418240,
      description: 'The expected size of the file to be uploaded in bytes (max 10 GB).'
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
        required: ['partNumber', 'url', 'partSizeBytes'],
        properties: {
          partNumber: {
            type: 'integer',
            minimum: 1
          },
          url: {
            type: 'string',
            format: 'uri'
          },
          partSizeBytes: {
            type: 'integer',
            minimum: 1,
            description: 'Exact byte size for this part upload.'
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
      maximum: 10737418240,
      description: 'The expected size of the file to be uploaded in bytes (max 10 GB).'
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

export const SubmissionUploadReviewResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['submission_upload_review_id', 'submission_upload_id', 'scope', 'status', 'requested_by'],
  properties: {
    submission_upload_review_id: { type: 'integer', minimum: 1 },
    submission_upload_id: { type: 'string', format: 'uuid' },
    scope: { type: 'string', enum: ['validation', 'security'] },
    status: { type: 'string', enum: ['requested', 'in_progress', 'completed', 'blocked', 'skipped', 'cancelled'] },
    requested_by: { type: 'integer', minimum: 1, nullable: true }
  }
};

export const RequestSubmissionUploadReviewRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['scope'],
  properties: {
    scope: { type: 'string', enum: ['validation', 'security'] }
  }
};

export const UpdateSubmissionUploadReviewRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['requested', 'in_progress', 'completed', 'blocked', 'skipped', 'cancelled'] }
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

export const CreateTicketUploadSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['file_name', 'byte_size'],
  properties: {
    file_name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Attachment filename used for markdown link label.'
    },
    byte_size: {
      type: 'integer',
      minimum: 1,
      maximum: 15728640,
      description: 'Attachment file size in bytes.'
    },
    content_type: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Optional attachment content type used for upload metadata.'
    }
  }
};

export const CreateTicketUploadResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['upload_id', 'presigned_upload_url'],
  properties: {
    upload_id: {
      type: 'string',
      format: 'uuid',
      description: 'Upload lifecycle identifier.'
    },
    presigned_upload_url: {
      type: 'string',
      format: 'uri',
      description: 'Presigned PUT URL for direct upload to the quarantine bucket.'
    }
  }
};

export const CompleteTicketUploadSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: {
      type: 'string',
      enum: ['uploaded'],
      description: 'Marks the upload as completed client-side and triggers async backend processing.'
    }
  }
};

export const ArtifactDownloadResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['signed_url'],
  properties: {
    signed_url: {
      type: 'string',
      format: 'uri',
      description: 'Presigned GET URL for downloading the ticket attachment.'
    }
  }
};
