import { IDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import {
  SubmissionUploadReview,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewStatus
} from '../../models/submission-upload-review';
import { SubmissionUploadReviewRepository } from '../../repositories/upload/submission-upload-review-repository';
import { DBService } from '../db-service';

export class SubmissionUploadReviewService extends DBService {
  submissionUploadReviewRepository: SubmissionUploadReviewRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadReviewRepository = new SubmissionUploadReviewRepository(connection);
  }

  async findReviewsBySubmissionUploadId(submissionUploadId: string): Promise<SubmissionUploadReview[]> {
    return this.submissionUploadReviewRepository.findReviewsBySubmissionUploadId(submissionUploadId);
  }

  async findReviewsBySubmissionUploadIds(submissionUploadIds: string[]): Promise<SubmissionUploadReview[]> {
    return this.submissionUploadReviewRepository.findReviewsBySubmissionUploadIds(submissionUploadIds);
  }

  async requestReview(params: {
    submissionUploadId: string;
    scope: SubmissionUploadReviewScope;
    requestedBy: number;
    note?: string;
    metadata?: Record<string, unknown>;
  }): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.requestReview(params);
  }

  async updateReviewStatus(params: {
    submissionUploadReviewId: number;
    status: SubmissionUploadReviewStatus;
    userId: number;
    assignedTo?: number | null;
    note?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.updateReviewStatus(params);
  }

  async requestDefaultReviewsForUpload(params: {
    submissionUploadId: string;
    requestedBy: number;
  }): Promise<SubmissionUploadReview[]> {
    const validationReview = await this.requestReview({
      submissionUploadId: params.submissionUploadId,
      scope: SubmissionUploadReviewScope.VALIDATION,
      requestedBy: params.requestedBy
    });

    const securityReview = await this.requestReview({
      submissionUploadId: params.submissionUploadId,
      scope: SubmissionUploadReviewScope.SECURITY,
      requestedBy: params.requestedBy
    });

    return [validationReview, securityReview];
  }

  async assertRequiredReviewsResolvedForApproval(submissionUploadId: string): Promise<void> {
    const hasUnresolvedRequiredReviews = await this.submissionUploadReviewRepository.hasUnresolvedRequiredReviews(
      submissionUploadId
    );

    if (hasUnresolvedRequiredReviews) {
      throw new HTTP400('Submission upload has unresolved required reviews', [
        'SubmissionUploadReviewService->assertRequiredReviewsResolvedForApproval',
        { submissionUploadId }
      ]);
    }
  }
}
