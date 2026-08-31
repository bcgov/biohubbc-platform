import { z } from 'zod';

export const DataRequestRecord = z.object({
  data_request_id: z.string().uuid(),
  record_end_date: z.string().nullable()
});

export type DataRequestRecord = z.infer<typeof DataRequestRecord>;

export const TicketRecord = z.object({
  ticket_id: z.string().uuid(),
  record_end_date: z.string().nullable()
});

export type TicketRecord = z.infer<typeof TicketRecord>;

export const SubmissionUploadRecord = z.object({
  submission_upload_id: z.string().uuid(),
  record_end_date: z.string().nullable()
});

export type SubmissionUploadRecord = z.infer<typeof SubmissionUploadRecord>;

export const SubmissionRecord = z.object({
  submission_id: z.number(),
  record_end_date: z.string().nullable()
});

export type SubmissionRecord = z.infer<typeof SubmissionRecord>;

export const TeamAuthorizationResult = z.object({
  authorized: z.boolean()
});

export type TeamAuthorizationResult = z.infer<typeof TeamAuthorizationResult>;
