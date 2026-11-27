import { OpenAPIV3 } from 'openapi-types';
import { FORM_SUBMISSION_MAX_SECTION_ROWS } from '../../constants/form';
import { FormSubmissionStatus } from '../../models/form-submission';
import { SubmissionUploadDecision, SubmissionUploadJobStatus } from '../../models/submission-upload';
import { paginationResponseSchema } from './pagination';

const UPLOAD_STATUSES = SubmissionUploadJobStatus.options;

const UPLOAD_DECISIONS = SubmissionUploadDecision.options;

/**
 * Schema for the draft document of a form submission. Values are keyed by feature property identifier.
 */
export const FormSubmissionDataSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['sections'],
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['featureTypeId', 'rows'],
        properties: {
          featureTypeId: { type: 'integer', minimum: 1 },
          rows: {
            type: 'array',
            maxItems: FORM_SUBMISSION_MAX_SECTION_ROWS,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['sourceId', 'values'],
              properties: {
                sourceId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Stable identifier of the row, kept across saves and revisions'
                },
                values: {
                  type: 'object',
                  description:
                    'Entered values keyed by feature property identifier: a string, number, boolean or null each',
                  additionalProperties: true
                }
              }
            }
          }
        }
      }
    }
  }
};

/**
 * Schema for replacing a form submission's draft.
 */
export const UpdateFormSubmissionRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['data'],
  properties: { data: FormSubmissionDataSchema }
};

/**
 * Schema for a form submission with the caller's relationship to it and its latest submit.
 */
export const FormSubmissionDetailSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['form_submission', 'is_owner', 'is_form_admin', 'latest_upload'],
  properties: {
    form_submission: {
      type: 'object',
      required: [
        'form_submission_id',
        'uuid',
        'form_id',
        'form_version_id',
        'team_id',
        'submission_id',
        'status',
        'data',
        'submitted_date',
        'create_date',
        'create_user'
      ],
      properties: {
        form_submission_id: { type: 'integer' },
        uuid: { type: 'string', format: 'uuid' },
        form_id: { type: 'integer' },
        form_version_id: { type: 'integer' },
        team_id: { type: 'string', format: 'uuid' },
        submission_id: { type: 'integer', nullable: true },
        status: { type: 'string', enum: FormSubmissionStatus.options },
        data: FormSubmissionDataSchema,
        submitted_date: { type: 'string', nullable: true },
        create_date: { type: 'string' },
        create_user: { type: 'integer' }
      }
    },
    is_owner: { type: 'boolean', description: 'Whether the caller may edit and submit the form submission' },
    is_form_admin: { type: 'boolean', description: "Whether the caller may review the form's submissions" },
    latest_upload: {
      type: 'object',
      nullable: true,
      required: ['submission_upload_id', 'status', 'decision', 'data', 'create_date'],
      properties: {
        submission_upload_id: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: UPLOAD_STATUSES },
        decision: { type: 'string', enum: UPLOAD_DECISIONS },
        data: FormSubmissionDataSchema,
        create_date: { type: 'string' }
      }
    }
  }
};

/**
 * Schema for a page of a form's submissions.
 */
export const FormSubmissionsResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['form_submissions', 'is_form_admin', 'pagination'],
  properties: {
    form_submissions: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'form_submission_id',
          'uuid',
          'status',
          'submitted_date',
          'create_date',
          'submitted_by_identifier',
          'submission_upload_id',
          'upload_status',
          'upload_decision'
        ],
        properties: {
          form_submission_id: { type: 'integer' },
          uuid: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: FormSubmissionStatus.options },
          submitted_date: { type: 'string', nullable: true },
          create_date: { type: 'string' },
          submitted_by_identifier: { type: 'string', nullable: true },
          submission_upload_id: { type: 'string', format: 'uuid', nullable: true },
          upload_status: { type: 'string', enum: UPLOAD_STATUSES, nullable: true },
          upload_decision: { type: 'string', enum: UPLOAD_DECISIONS, nullable: true }
        }
      }
    },
    is_form_admin: { type: 'boolean', description: "Whether the caller may review the form's submissions" },
    pagination: paginationResponseSchema
  }
};

/**
 * Path parameters addressing one form submission.
 */
export const formSubmissionParameters: OpenAPIV3.ParameterObject[] = [
  { in: 'path', name: 'slug', required: true, schema: { type: 'string' } },
  { in: 'path', name: 'formSubmissionUuid', required: true, schema: { type: 'string', format: 'uuid' } }
];
