import { z } from 'zod';
import { ApiPaginationResults } from '../zod-schema/pagination';
import { SubmissionUploadReview } from './submission-upload-review';
import { TicketSubmissionValidation } from './submission-validation';
import { UploadArtifactRoleEnum } from './upload-artifact';

export const SubmissionUploadJobStatus = z.enum([
  'uploaded',
  'ingesting',
  'ingested',
  'reconciled',
  'promoted',
  'indexing',
  'indexed',
  // Terminal failure states
  'invalid',
  'failed'
]);
export type SubmissionUploadJobStatus = z.infer<typeof SubmissionUploadJobStatus>;

/**
 * Human review decision on a submission upload, independent of its processing status.
 */
export const SubmissionUploadDecision = z.enum(['pending', 'approved', 'denied']);
export type SubmissionUploadDecision = z.infer<typeof SubmissionUploadDecision>;

/**
 * SubmissionUpload table schema
 */
export const SubmissionUpload = z.object({
  submission_upload_id: z.string().uuid(),
  submission_id: z.number(),
  upload_id: z.string().uuid(),
  team_id: z.string().uuid(),
  status: SubmissionUploadJobStatus,
  decision: SubmissionUploadDecision,
  ticket_id: z.string().uuid(),
  blueprint_id: z.number(),
  successor_submission_upload_id: z.string().uuid().nullable().optional(),
  comment: z.string().nullable().optional(),
  record_end_date: z.coerce.date().nullable().optional()
});
export type SubmissionUpload = z.infer<typeof SubmissionUpload>;

/** Active upload fields shown in the administrative submission list. */
export const AdminSubmissionUpload = SubmissionUpload.pick({
  submission_upload_id: true,
  upload_id: true,
  status: true,
  decision: true,
  ticket_id: true
}).extend({
  comment: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  submitted_by_identifier: z.string().nullable()
});
export type AdminSubmissionUpload = z.infer<typeof AdminSubmissionUpload>;

export interface AdminSubmissionUploadsResponse {
  uploads: AdminSubmissionUpload[];
  pagination: ApiPaginationResults;
}

/**
 * Payload for creating a new SubmissionUpload
 */
export const CreateSubmissionUpload = z.object({
  submission_id: z.number(),
  upload_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  status: SubmissionUploadJobStatus,
  blueprint_id: z.number(),
  comment: z.string().nullable().optional()
});
export type CreateSubmissionUpload = z.infer<typeof CreateSubmissionUpload>;

/**
 * SubmissionUpload payload after its owning team has been created.
 */
export const CreateSubmissionUploadWithTeam = CreateSubmissionUpload.extend({
  team_id: z.string().uuid()
});
export type CreateSubmissionUploadWithTeam = z.infer<typeof CreateSubmissionUploadWithTeam>;

/**
 * Payload for updating an existing SubmissionUpload.
 *
 * `status` and `decision` are not updatable here: processing status changes go through
 * `SubmissionUploadService.transitionSubmissionUploadStatus`, which also records the history row,
 * and decisions go through `SubmissionUploadService.updateSubmissionUploadDecision`.
 */
export const UpdateSubmissionUpload = z.object({
  submission_id: z.number().optional(),
  upload_id: z.string().uuid().optional(),
  ticket_id: z.string().uuid().optional()
});
export type UpdateSubmissionUpload = z.infer<typeof UpdateSubmissionUpload>;

export interface SubmissionUploadFilters {
  role?: UploadArtifactRoleEnum;
}

export const TicketSubmissionUploadReviews = z.object({
  validation: z.array(SubmissionUploadReview),
  security: z.array(SubmissionUploadReview)
});
export type TicketSubmissionUploadReviews = z.infer<typeof TicketSubmissionUploadReviews>;

export const TicketSubmissionUpload = z.object({
  submission_upload_id: z.string().uuid(),
  submission_id: z.number().int().positive(),
  upload_id: z.string().uuid(),
  create_date: z.string(),
  submission_name: z.string().nullable(),
  submission_description: z.string().nullable(),
  submission_comment: z.string().nullable(),
  submitted_by_identifier: z.string().nullable(),
  upload_status: SubmissionUploadJobStatus,
  decision: SubmissionUploadDecision,
  validation: TicketSubmissionValidation.nullable(),
  reviews: TicketSubmissionUploadReviews
});
export type TicketSubmissionUpload = z.infer<typeof TicketSubmissionUpload>;

/** Identity supplied for an additional submission/upload team member. */
export interface SubmissionUploadSubmitter {
  guid: string;
  identifier: string;
  identitySource: string;
}

export type SubmissionArchiveFormat = 'tar' | 'tar.gz';

/** Request fields for creating a submission and its first archive upload. */
export interface CreateSubmissionArchiveUploadInput {
  contributorId: number;
  bytes: number;
  archiveFormat?: SubmissionArchiveFormat;
  name: string;
  description: string;
  comment: string;
  submitters?: SubmissionUploadSubmitter[];
  blueprintId?: number | null;
}

/** Request fields for appending an archive to an existing submission. */
export interface CreateExistingSubmissionArchiveUploadInput {
  bytes: number;
  archiveFormat?: SubmissionArchiveFormat;
  submissionUuid: string;
  submitters?: SubmissionUploadSubmitter[];
  blueprintId?: number | null;
}

/** Resolved submission context for starting an archive upload. */
export interface StartSubmissionArchiveUploadInput {
  bytes: number;
  submissionId: number;
  submissionUuid: string;
  systemUserIds: number[];
  submitterSystemUserIds: number[];
  comment: string | null;
  requestedBlueprintId?: number | null;
  archiveFormat?: SubmissionArchiveFormat;
}
