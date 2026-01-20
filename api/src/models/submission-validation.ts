import { z } from 'zod';

export const SubmissionValidationStatus = z.enum(['pending', 'started', 'completed', 'invalid', 'failed']);
export type SubmissionValidationStatus = z.infer<typeof SubmissionValidationStatus>;

export const SubmissionValidationRecord = z.object({
  submission_validation_id: z.number(),
  job_id: z.string(),
  status: SubmissionValidationStatus
});
export type SubmissionValidationRecord = z.infer<typeof SubmissionValidationRecord>;

export const SubmissionValidationId = SubmissionValidationRecord.pick({ submission_validation_id: true });
export type SubmissionValidationId = z.infer<typeof SubmissionValidationId>;
