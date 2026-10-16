import { OpenAPIV3 } from 'openapi-types';
import { SubmissionUploadDecision, SubmissionUploadJobStatus } from '../../models/submission-upload';

export const submissionUploadParameters: OpenAPIV3.ParameterObject[] = [
  { in: 'path', name: 'submissionId', required: true, schema: { type: 'integer', minimum: 1 } },
  { in: 'path', name: 'submissionUploadId', required: true, schema: { type: 'string', format: 'uuid' } }
];

/**
 * An active submission upload as listed and read by administrators.
 */
export const AdminSubmissionUploadSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'submission_upload_id',
    'upload_id',
    'status',
    'decision',
    'ticket_id',
    'comment',
    'create_date',
    'create_user',
    'submitted_by_identifier'
  ],
  properties: {
    submission_upload_id: { type: 'string', format: 'uuid' },
    upload_id: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: SubmissionUploadJobStatus.options },
    decision: { type: 'string', enum: SubmissionUploadDecision.options },
    ticket_id: { type: 'string', format: 'uuid' },
    comment: { type: 'string', nullable: true },
    create_date: { type: 'string' },
    create_user: { type: 'integer' },
    submitted_by_identifier: { type: 'string', nullable: true }
  }
};
