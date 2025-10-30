import { z } from 'zod';
import { QuarantineRecord } from './quarantine';

/**
 * Interface for updating a quarantine scan file record
 */
export interface IUpdateSubmission {
  uri?: string;
  name?: string;
  description?: string;
}

/**
 * Submission record schema
 */
export const SubmissionRecord = z.object({
  submission_id: z.number(),
  uuid: z.string(),
  uri: z.string().nullable(),
  quarantine_id: z.string().nullable(),
  security_review_timestamp: z.string().nullable(),
  submitted_timestamp: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  comment: z.string().nullable(),
  publish_timestamp: z.string().nullable()
});

export type SubmissionRecord = z.infer<typeof SubmissionRecord>;

/**
 * Quarantine record schema
 */
export const SubmissionRecordWithQuarantine = z.object({
  submission_id: z.number(),
  name: z.string(),
  description: z.string(),
  submitted_timestamp: z.string(),
  quarantine: QuarantineRecord
});

export type SubmissionRecordWithQuarantine = z.infer<typeof SubmissionRecordWithQuarantine>;

/**
 * Submission table model.
 *
 * @export
 * @interface ISubmissionModel
 */
export interface ISubmissionModel {
  submission_id?: number;
  uuid: string;
  uri: string | null;
  security_review_timestamp?: string | null;
  create_date?: string;
  create_user?: number;
  update_date?: string | null;
  update_user?: number | null;
  revision_count?: number;
}
