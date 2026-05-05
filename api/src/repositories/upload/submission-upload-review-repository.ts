import { SQL } from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  SubmissionUploadReview,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewStatus
} from '../../models/submission-upload-review';
import { BaseRepository } from '../base-repository';

const ACTIVE_REVIEW_STATUSES = [
  SubmissionUploadReviewStatus.REQUESTED,
  SubmissionUploadReviewStatus.IN_PROGRESS,
  SubmissionUploadReviewStatus.BLOCKED
];

const HasUnresolvedRequiredReviews = z.object({
  has_unresolved_required_reviews: z.boolean()
});

export class SubmissionUploadReviewRepository extends BaseRepository {
  async findReviewsBySubmissionUploadId(submissionUploadId: string): Promise<SubmissionUploadReview[]> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by,
        requested_at,
        assigned_to,
        started_at,
        completed_by,
        completed_at,
        note,
        metadata,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count,
        record_end_date
      FROM
        submission_upload_review
      WHERE
        submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL
      ORDER BY
        create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);
    return response.rows;
  }

  async findReviewsBySubmissionUploadIds(submissionUploadIds: string[]): Promise<SubmissionUploadReview[]> {
    if (submissionUploadIds.length === 0) {
      return [];
    }

    const sqlStatement = SQL`
      SELECT
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by,
        requested_at,
        assigned_to,
        started_at,
        completed_by,
        completed_at,
        note,
        metadata,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count,
        record_end_date
      FROM
        submission_upload_review
      WHERE
        submission_upload_id = ANY(${submissionUploadIds}::uuid[])
        AND record_end_date IS NULL
      ORDER BY
        submission_upload_id ASC,
        create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);
    return response.rows;
  }

  async requestReview(params: {
    submissionUploadId: string;
    scope: SubmissionUploadReviewScope;
    requestedBy: number;
    note?: string;
    metadata?: Record<string, unknown>;
  }): Promise<SubmissionUploadReview> {
    const metadata = params.metadata ? JSON.stringify(params.metadata) : null;
    const note = params.note ?? null;
    const sqlStatement = SQL`
      INSERT INTO submission_upload_review (
        submission_upload_id,
        scope,
        status,
        requested_by,
        requested_at,
        note,
        metadata,
        create_user
      )
      SELECT
        ${params.submissionUploadId},
        ${params.scope}::submission_upload_review_scope,
        'requested'::submission_upload_review_status,
        ${params.requestedBy},
        now(),
        ${note},
        ${metadata}::jsonb,
        ${params.requestedBy}
      WHERE NOT EXISTS (
        SELECT 1
        FROM submission_upload_review
        WHERE submission_upload_id = ${params.submissionUploadId}
          AND scope = ${params.scope}::submission_upload_review_scope
          AND record_end_date IS NULL
          AND status IN ('requested', 'in_progress', 'blocked')
      )
      RETURNING
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by,
        requested_at,
        assigned_to,
        started_at,
        completed_by,
        completed_at,
        note,
        metadata,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count,
        record_end_date;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);

    if (response.rowCount === 1) {
      return response.rows[0];
    }

    return this.getActiveReviewBySubmissionUploadIdAndScope(params.submissionUploadId, params.scope);
  }

  async updateReviewStatus(params: {
    submissionUploadReviewId: number;
    status: SubmissionUploadReviewStatus;
    userId: number;
    assignedTo?: number | null;
    note?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<SubmissionUploadReview> {
    const noteProvided = Object.prototype.hasOwnProperty.call(params, 'note');
    const metadataProvided = Object.prototype.hasOwnProperty.call(params, 'metadata');
    const note = noteProvided ? params.note ?? null : null;
    const metadata = metadataProvided && params.metadata ? JSON.stringify(params.metadata) : null;

    const sqlStatement = SQL`
      UPDATE submission_upload_review
      SET
        status = ${params.status}::submission_upload_review_status,
        assigned_to = CASE
          WHEN ${params.status} = 'in_progress' THEN COALESCE(${params.assignedTo ?? null}, assigned_to, ${
      params.userId
    })
          WHEN ${params.assignedTo ?? null} IS NOT NULL THEN ${params.assignedTo ?? null}
          ELSE assigned_to
        END,
        started_at = CASE
          WHEN ${params.status} = 'in_progress' THEN COALESCE(started_at, now())
          ELSE started_at
        END,
        completed_by = CASE
          WHEN ${params.status} IN ('completed', 'blocked', 'skipped', 'cancelled') THEN ${params.userId}
          WHEN ${params.status} = 'requested' THEN NULL
          ELSE completed_by
        END,
        completed_at = CASE
          WHEN ${params.status} IN ('completed', 'blocked', 'skipped', 'cancelled') THEN now()
          WHEN ${params.status} = 'requested' THEN NULL
          ELSE completed_at
        END,
        note = CASE WHEN ${noteProvided} THEN ${note} ELSE note END,
        metadata = CASE WHEN ${metadataProvided} THEN ${metadata}::jsonb ELSE metadata END
      WHERE
        submission_upload_review_id = ${params.submissionUploadReviewId}
        AND record_end_date IS NULL
      RETURNING
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by,
        requested_at,
        assigned_to,
        started_at,
        completed_by,
        completed_at,
        note,
        metadata,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count,
        record_end_date;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission_upload_review record', [
        'SubmissionUploadReviewRepository->updateReviewStatus',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  async hasUnresolvedRequiredReviews(submissionUploadId: string): Promise<boolean> {
    const sqlStatement = SQL`
      SELECT (
        EXISTS (
          SELECT 1
          FROM unnest(ARRAY['validation', 'security']::submission_upload_review_scope[]) required_scope(scope)
          WHERE NOT EXISTS (
            SELECT 1
            FROM submission_upload_review sur
            WHERE sur.submission_upload_id = ${submissionUploadId}
              AND sur.scope = required_scope.scope
              AND sur.record_end_date IS NULL
              AND sur.status IN ('completed', 'skipped')
          )
        )
        OR EXISTS (
          SELECT 1
          FROM submission_upload_review sur
          WHERE sur.submission_upload_id = ${submissionUploadId}
            AND sur.record_end_date IS NULL
            AND sur.status = 'blocked'
        )
      ) AS has_unresolved_required_reviews;
    `;

    const response = await this.connection.sql(sqlStatement, HasUnresolvedRequiredReviews);
    return Boolean(response.rows[0]?.has_unresolved_required_reviews);
  }

  private async getActiveReviewBySubmissionUploadIdAndScope(
    submissionUploadId: string,
    scope: SubmissionUploadReviewScope
  ): Promise<SubmissionUploadReview> {
    const reviews = await this.findReviewsBySubmissionUploadId(submissionUploadId);
    const activeReview = reviews.find(
      (review) => review.scope === scope && ACTIVE_REVIEW_STATUSES.includes(review.status)
    );

    if (!activeReview) {
      throw new ApiNotFoundError('Active submission upload review not found', [
        'SubmissionUploadReviewRepository->getActiveReviewBySubmissionUploadIdAndScope',
        { submissionUploadId, scope }
      ]);
    }

    return activeReview;
  }
}
