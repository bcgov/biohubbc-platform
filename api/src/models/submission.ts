import { z } from 'zod';
import { QuarantineRecord } from './quarantine';

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
 * Interface for updating a quarantine scan file record
 */
export interface IUpdateSubmission {
  uri?: string;
  name?: string;
  description?: string;
}
