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

export const TicketSubmissionValidation = z.object({
  submission_validation_id: z.number().nullable(),
  job_id: z.string().nullable(),
  status: SubmissionValidationStatus.nullable(),
  metadata: z.record(z.unknown()).nullable(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  create_date: z.string().nullable()
});
export type TicketSubmissionValidation = z.infer<typeof TicketSubmissionValidation>;
