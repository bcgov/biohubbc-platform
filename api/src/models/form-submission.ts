import { z } from 'zod';
import { IFlattenedBlock } from './submission-feature';
import { SubmissionUploadDecision, SubmissionUploadJobStatus } from './submission-upload';

/**
 * Lifecycle of a form submission. Editing a submitted form submission returns it to `draft`.
 */
export const FormSubmissionStatus = z.enum(['draft', 'submitted']);
export type FormSubmissionStatus = z.infer<typeof FormSubmissionStatus>;

/**
 * A value entered in one field of a form submission row.
 */
export const FormSubmissionValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type FormSubmissionValue = z.infer<typeof FormSubmissionValue>;

/**
 * One row of a form section: one feature. The source identifier is stable across saves and revisions, so a resubmitted
 * row reconciles against the feature it produced before.
 */
export const FormSubmissionRow = z.object({
  sourceId: z.string().uuid(),
  values: z.record(z.string(), FormSubmissionValue)
});
export type FormSubmissionRow = z.infer<typeof FormSubmissionRow>;

/**
 * The rows entered in one section of a form submission.
 */
export const FormSubmissionSectionData = z.object({
  featureTypeId: z.number().int(),
  rows: z.array(FormSubmissionRow)
});
export type FormSubmissionSectionData = z.infer<typeof FormSubmissionSectionData>;

/**
 * The draft document of a form submission. Values are keyed by feature property identifier.
 */
export const FormSubmissionData = z.object({
  sections: z.array(FormSubmissionSectionData)
});
export type FormSubmissionData = z.infer<typeof FormSubmissionData>;

/**
 * A form submission row.
 */
export const FormSubmission = z.object({
  form_submission_id: z.number(),
  uuid: z.string().uuid(),
  form_id: z.number(),
  form_version_id: z.number(),
  team_id: z.string().uuid(),
  submission_id: z.number().nullable(),
  status: FormSubmissionStatus,
  data: FormSubmissionData,
  submitted_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number()
});
export type FormSubmission = z.infer<typeof FormSubmission>;

/**
 * A form submission as listed, with its submitter and the processing status and review decision of its latest upload.
 * The upload fields are null for a form submission that has never been submitted.
 */
export const FormSubmissionListItem = z.object({
  form_submission_id: z.number(),
  uuid: z.string().uuid(),
  status: FormSubmissionStatus,
  submitted_date: z.string().nullable(),
  create_date: z.string(),
  submitted_by_identifier: z.string().nullable(),
  submission_upload_id: z.string().uuid().nullable(),
  upload_status: SubmissionUploadJobStatus.nullable(),
  upload_decision: SubmissionUploadDecision.nullable()
});
export type FormSubmissionListItem = z.infer<typeof FormSubmissionListItem>;

/**
 * The latest submit of a form submission: its upload's processing status and review decision, and the content
 * submitted.
 */
export const FormSubmissionLatestUpload = z.object({
  submission_upload_id: z.string().uuid(),
  status: SubmissionUploadJobStatus,
  decision: SubmissionUploadDecision,
  data: FormSubmissionData,
  create_date: z.string()
});
export type FormSubmissionLatestUpload = z.infer<typeof FormSubmissionLatestUpload>;

/**
 * The features one submit ingests.
 */
export const FormSubmissionUploadFeatures = z.object({
  features: z.array(z.record(z.string(), z.unknown()))
});
export type FormSubmissionUploadFeatures = z.infer<typeof FormSubmissionUploadFeatures>;

/**
 * Filters for listing a form's submissions. A team member filter narrows the list to the form submissions that user
 * may edit.
 */
export interface FormSubmissionFilters {
  teamMemberSystemUserId: number | null;
}

/**
 * Form submission row accepted on insert.
 */
export interface InsertFormSubmission {
  formId: number;
  formVersionId: number;
  teamId: string;
  data: FormSubmissionData;
}

/**
 * Snapshot of one submit accepted on insert.
 */
export interface InsertFormSubmissionUpload {
  submissionUploadId: string;
  formSubmissionId: number;
  formVersionId: number;
  data: FormSubmissionData;
  features: IFlattenedBlock[];
}

/**
 * A form submission with the caller's relationship to it and its latest submit.
 */
export interface FormSubmissionDetail {
  form_submission: FormSubmission;
  /** Whether the caller may edit and submit the form submission. */
  is_owner: boolean;
  /** Whether the caller may review the form's submissions. */
  is_form_admin: boolean;
  latest_upload: FormSubmissionLatestUpload | null;
}
