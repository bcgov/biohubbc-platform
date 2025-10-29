import { z } from 'zod';
import { QuarantineRecord } from './quarantine';

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
